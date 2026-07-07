import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { withTimestamp } from '../common/logging/log-payload';
import { JobEvent } from './job-events.types';

@Injectable()
export class JobEventsService {
  private readonly logger = new Logger(JobEventsService.name);
  private readonly events = new Subject<JobEvent>();

  emit(event: JobEvent) {
    const timestamp =
      event.timestamp ?? event.occurredAt ?? new Date().toISOString();
    const enrichedEvent = {
      ...event,
      occurredAt: event.occurredAt ?? timestamp,
      timestamp,
    };

    this.logger.debug(
      withTimestamp({
        event: 'JOB_EVENT_EMITTED',
        type: enrichedEvent.type,
        tenantId: enrichedEvent.tenantId,
        jobId: enrichedEvent.jobId,
      }),
    );

    this.events.next(enrichedEvent);
  }

  streamAll(): Observable<JobEvent> {
    return this.events.asObservable();
  }

  streamForTenant(tenantId: string): Observable<MessageEvent> {
    return this.events.asObservable().pipe(
      filter((event) => event.tenantId === tenantId),
      map(
        (event) =>
          ({
            type: event.type,
            data: event,
          }) as MessageEvent,
      ),
    );
  }
}
