import { Pipe, PipeTransform } from '@angular/core';

import { formatMsAsMmSs } from '../../core/utils/format-time';

@Pipe({
  name: 'formatMs',
  standalone: true,
})
export class FormatMsPipe implements PipeTransform {
  transform(ms: number | null | undefined): string {
    return formatMsAsMmSs(ms ?? 0);
  }
}
