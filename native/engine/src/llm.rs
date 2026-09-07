use anyhow::{Context, Result};
use candle_core::quantized::gguf_file;
use candle_core::{Device, Tensor};
use candle_transformers::generation::LogitsProcessor;
use candle_transformers::models::quantized_llama as model;
use hf_hub::api::sync::ApiBuilder;
use std::fs::File;
use std::path::{Path, PathBuf};
use tokenizers::Tokenizer;

const REPO: &str = "unsloth/SmolLM2-135M-Instruct-GGUF";
const FILE: &str = "SmolLM2-135M-Instruct-Q4_K_M.gguf";
const TOK_REPO: &str = "HuggingFaceTB/SmolLM2-135M-Instruct";

pub struct Llm {
    model: model::ModelWeights,
    tokenizer: Tokenizer,
    device: Device,
    eos: u32,
}

impl Llm {
    pub fn load(cache: &Path, mut progress: impl FnMut(u32, &str)) -> Result<Self> {
        progress(8, "Hugging Face önbelleği…");
        let api = ApiBuilder::new()
            .with_progress(false)
            .with_cache_dir(cache.join("hf"))
            .build()
            .context("hf-hub")?;
        progress(18, "SmolLM2-135M indiriliyor (~105 MB, bir kez)…");
        let model_path: PathBuf = api.model(REPO.to_string()).get(FILE).context("gguf")?;
        progress(55, "tokenizer.json…");
        let tok_path: PathBuf = api
            .model(TOK_REPO.to_string())
            .get("tokenizer.json")
            .context("tokenizer")?;
        progress(70, "Candle modeli yükleniyor…");
        let device = Device::Cpu;
        let mut file = File::open(&model_path)?;
        let content = gguf_file::Content::read(&mut file)?;
        let weights = model::ModelWeights::from_gguf(content, &mut file, &device)?;
        let tokenizer = Tokenizer::from_file(&tok_path).map_err(anyhow::Error::msg)?;
        let eos = tokenizer
            .token_to_id("<|im_end|>")
            .or_else(|| tokenizer.token_to_id("<|endoftext|>"))
            .unwrap_or(0);
        progress(95, "örnekleyici hazır");
        Ok(Self {
            model: weights,
            tokenizer,
            device,
            eos,
        })
    }

    pub fn complete(&mut self, prompt: &str, max_tokens: usize) -> Result<String> {
        let enc = self
            .tokenizer
            .encode(prompt, true)
            .map_err(anyhow::Error::msg)?;
        let mut tokens = enc.get_ids().to_vec();
        if tokens.len() > 420 {
            tokens = tokens[tokens.len() - 420..].to_vec();
        }
        let mut sampled = LogitsProcessor::new(42, Some(0.7), Some(0.9));
        let input = Tensor::new(tokens.as_slice(), &self.device)?.unsqueeze(0)?;
        let logits = self.model.forward(&input, 0)?.squeeze(0)?;
        let mut next = sampled.sample(&logits)?;
        let mut out_ids = vec![next];
        for i in 0..max_tokens.saturating_sub(1) {
            if next == self.eos {
                break;
            }
            let input = Tensor::new(&[next], &self.device)?.unsqueeze(0)?;
            let logits = self.model.forward(&input, tokens.len() + i)?.squeeze(0)?;
            next = sampled.sample(&logits)?;
            out_ids.push(next);
        }
        if out_ids.last() == Some(&self.eos) {
            out_ids.pop();
        }
        let text = self
            .tokenizer
            .decode(&out_ids, true)
            .map_err(anyhow::Error::msg)?;
        Ok(text
            .replace("<|im_end|>", "")
            .replace("<|endoftext|>", "")
            .trim()
            .to_string())
    }
}

pub fn chat_prompt(system: &str, history: &[(String, String)], user: &str) -> String {
    let mut s = format!("<|im_start|>system\n{system}<|im_end|>\n");
    for (u, a) in history {
        s.push_str(&format!(
            "<|im_start|>user\n{u}<|im_end|>\n<|im_start|>assistant\n{a}<|im_end|>\n"
        ));
    }
    s.push_str(&format!(
        "<|im_start|>user\n{user}<|im_end|>\n<|im_start|>assistant\n"
    ));
    s
}
