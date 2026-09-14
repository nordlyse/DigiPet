#import <EventKit/EventKit.h>
#import <Foundation/Foundation.h>
#include <stdio.h>
#include <string.h>

static BOOL askAccess(EKEventStore *store) {
    __block BOOL ok = NO;
    dispatch_semaphore_t sem = dispatch_semaphore_create(0);
    void (^done)(BOOL, NSError *) = ^(BOOL granted, NSError *error) {
        (void)error;
        ok = granted;
        dispatch_semaphore_signal(sem);
    };
    if (@available(macOS 14.0, *)) {
        [store requestFullAccessToEventsWithCompletion:done];
    } else {
        [store requestAccessToEntityType:EKEntityTypeEvent completion:done];
    }
    dispatch_semaphore_wait(sem, dispatch_time(DISPATCH_TIME_NOW, 45 * NSEC_PER_SEC));
    return ok;
}

static NSString *flat(NSString *s) {
    if (!s.length) return @"";
    NSString *one = [[s componentsSeparatedByCharactersInSet:[NSCharacterSet newlineCharacterSet]] componentsJoinedByString:@" "];
    return [one stringByReplacingOccurrencesOfString:@"\t" withString:@" "];
}

static BOOL statusAllowsEvents(EKAuthorizationStatus st) {
    if (@available(macOS 14.0, *)) {
        return st == EKAuthorizationStatusFullAccess || st == EKAuthorizationStatusWriteOnly;
    }
    return st == EKAuthorizationStatusAuthorized;
}

static NSDate *parseLocal(NSString *iso) {
    NSISO8601DateFormatter *fmt = [NSISO8601DateFormatter new];
    fmt.formatOptions = NSISO8601DateFormatWithInternetDateTime;
    NSDate *d = [fmt dateFromString:iso];
    if (d) return d;
    NSDateFormatter *local = [NSDateFormatter new];
    local.locale = [NSLocale localeWithLocaleIdentifier:@"en_US_POSIX"];
    local.timeZone = [NSTimeZone localTimeZone];
    local.dateFormat = @"yyyy-MM-dd'T'HH:mm:ss";
    return [local dateFromString:iso];
}

static int listNext(EKEventStore *store) {
    NSDate *start = [NSDate date];
    NSDate *end = [start dateByAddingTimeInterval:60.0 * 60.0 * 24.0 * 60.0];
    NSPredicate *pred = [store predicateForEventsWithStartDate:start endDate:end calendars:nil];
    NSArray<EKEvent *> *events = [[store eventsMatchingPredicate:pred]
        sortedArrayUsingComparator:^NSComparisonResult(EKEvent *a, EKEvent *b) {
            return [a.startDate compare:b.startDate];
        }];
    if (events.count == 0) {
        puts("NONE");
        return 0;
    }
    EKEvent *ev = events.firstObject;
    NSDateFormatter *fmt = [NSDateFormatter new];
    fmt.locale = [NSLocale currentLocale];
    fmt.timeZone = [NSTimeZone localTimeZone];
    fmt.dateStyle = NSDateFormatterMediumStyle;
    fmt.timeStyle = NSDateFormatterShortStyle;
    NSString *when = [fmt stringFromDate:ev.startDate] ?: @"";
    NSString *title = flat(ev.title.length ? ev.title : @"DigiPet");
    NSString *where = flat(ev.location ?: @"");
    printf("%s\t%s\t%s\n", title.UTF8String, when.UTF8String, where.UTF8String);
    return 0;
}

static int insertEvent(EKEventStore *store, NSString *title, NSString *startIso, NSString *endIso) {
    NSDate *start = parseLocal(startIso);
    NSDate *end = parseLocal(endIso);
    if (!start || !end) {
        fputs("BAD_DATE\n", stderr);
        return 1;
    }
    EKEvent *ev = [EKEvent eventWithEventStore:store];
    ev.title = title.length ? title : @"DigiPet";
    ev.startDate = start;
    ev.endDate = end;
    ev.calendar = [store defaultCalendarForNewEvents];
    if (!ev.calendar) {
        fputs("NO_CAL\n", stderr);
        return 1;
    }
    NSError *err = nil;
    if (![store saveEvent:ev span:EKSpanThisEvent commit:YES error:&err]) {
        fprintf(stderr, "%s\n", err.localizedDescription.UTF8String ?: "SAVE_FAIL");
        return 1;
    }
    puts("OK");
    return 0;
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc < 2) {
            fputs("usage: calendar list | calendar insert TITLE START END\n", stderr);
            return 1;
        }
        EKEventStore *store = [EKEventStore new];
        EKAuthorizationStatus st = [EKEventStore authorizationStatusForEntityType:EKEntityTypeEvent];
        if (st == EKAuthorizationStatusDenied || st == EKAuthorizationStatusRestricted) {
            puts("NEED_PERM");
            return 2;
        }
        if (!statusAllowsEvents(st) && !askAccess(store)) {
            puts("NEED_PERM");
            return 2;
        }
        NSString *cmd = [NSString stringWithUTF8String:argv[1]];
        if ([cmd isEqualToString:@"list"]) return listNext(store);
        if ([cmd isEqualToString:@"insert"] && argc >= 5) {
            NSString *title = [NSString stringWithUTF8String:argv[2]];
            NSString *start = [NSString stringWithUTF8String:argv[3]];
            NSString *end = [NSString stringWithUTF8String:argv[4]];
            return insertEvent(store, title, start, end);
        }
        fputs("BAD_ARGS\n", stderr);
        return 1;
    }
}
