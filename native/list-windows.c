#include <CoreFoundation/CoreFoundation.h>
#include <CoreGraphics/CoreGraphics.h>
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static void json_string(const char *s) {
    putchar('"');
    if (!s) {
        putchar('"');
        return;
    }
    for (; *s; s++) {
        unsigned char c = (unsigned char)*s;
        if (c == '"' || c == '\\') {
            putchar('\\');
            putchar((char)c);
        } else if (c == '\n') {
            fputs("\\n", stdout);
        } else if (c < 32) {
            continue;
        } else {
            putchar((char)c);
        }
    }
    putchar('"');
}

static int skip_app(const char *app) {
    static const char *skip[] = {
        "Window Server", "Dock", "Control Center", "Notification Centre",
        "Notification Center", "SystemUIServer", "Spotlight", "Wallpaper",
        "WindowManager", "loginwindow", "Screenshot", "ScreenSaverEngine",
        "DigiPet", "Electron", NULL
    };
    for (int i = 0; skip[i]; i++) {
        if (strcmp(app, skip[i]) == 0) return 1;
    }
    char lower[256];
    size_t n = strlen(app);
    if (n >= sizeof(lower)) n = sizeof(lower) - 1;
    for (size_t i = 0; i < n; i++) lower[i] = (char)tolower((unsigned char)app[i]);
    lower[n] = 0;
    return strstr(lower, "digipet") != NULL;
}

static void dump(int exclude_pid) {
    CFArrayRef list = CGWindowListCopyWindowInfo(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID);
    printf("[");
    int first = 1;
    if (list) {
        CFIndex count = CFArrayGetCount(list);
        for (CFIndex i = 0; i < count; i++) {
            CFDictionaryRef info = CFArrayGetValueAtIndex(list, i);
            int layer = 0, pid = 0, wid = 0;
            CFNumberRef layerN = CFDictionaryGetValue(info, kCGWindowLayer);
            if (layerN) CFNumberGetValue(layerN, kCFNumberIntType, &layer);
            if (layer != 0) continue;
            CFNumberRef pidN = CFDictionaryGetValue(info, kCGWindowOwnerPID);
            if (pidN) CFNumberGetValue(pidN, kCFNumberIntType, &pid);
            if (pid == exclude_pid) continue;
            char app[256] = {0};
            char title[512] = {0};
            CFStringRef owner = CFDictionaryGetValue(info, kCGWindowOwnerName);
            if (owner) CFStringGetCString(owner, app, sizeof(app), kCFStringEncodingUTF8);
            if (skip_app(app)) continue;
            CFNumberRef alphaN = CFDictionaryGetValue(info, kCGWindowAlpha);
            double alpha = 1;
            if (alphaN) CFNumberGetValue(alphaN, kCFNumberDoubleType, &alpha);
            if (alpha < 0.08) continue;
            CFDictionaryRef bounds = CFDictionaryGetValue(info, kCGWindowBounds);
            CGRect r = CGRectZero;
            if (!bounds || !CGRectMakeWithDictionaryRepresentation(bounds, &r)) continue;
            if (r.size.width < 200 || r.size.height < 120) continue;
            CFNumberRef idN = CFDictionaryGetValue(info, kCGWindowNumber);
            if (idN) CFNumberGetValue(idN, kCFNumberIntType, &wid);
            CFStringRef name = CFDictionaryGetValue(info, kCGWindowName);
            if (name) CFStringGetCString(name, title, sizeof(title), kCFStringEncodingUTF8);
            if (!first) putchar(',');
            first = 0;
            printf("{\"id\":%d,\"app\":", wid);
            json_string(app);
            printf(",\"title\":");
            json_string(title);
            printf(",\"x\":%.1f,\"y\":%.1f,\"w\":%.1f,\"h\":%.1f}", r.origin.x, r.origin.y, r.size.width, r.size.height);
        }
        CFRelease(list);
    }
    printf("]\n");
    fflush(stdout);
}

int main(int argc, char **argv) {
    int exclude_pid = 0;
    for (int i = 1; i < argc - 1; i++) {
        if (strcmp(argv[i], "--exclude-pid") == 0) exclude_pid = atoi(argv[i + 1]);
    }
    for (;;) {
        dump(exclude_pid);
        usleep(400000);
    }
}
