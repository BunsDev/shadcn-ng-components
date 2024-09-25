import { cn } from '@/lib/utils'

import { computed, Directive, input } from '@angular/core'

@Directive({
  standalone: true,
  selector: '[ubCard]',
  host: {
    '[class]': 'computedClass()',
  },
})
export class UbCardDirective {
  readonly class = input<string>()
  protected computedClass = computed(() =>
    cn('rounded-lg border bg-card text-card-foreground shadow-sm', this.class()),
  )
}

@Directive({
  standalone: true,
  selector: '[ubCardHeader]',
  host: {
    '[class]': 'computedClass()',
  },
})
export class UbCardHeaderDirective {
  readonly class = input<string>()
  protected computedClass = computed(() =>
    cn('flex flex-col space-y-1.5 p-6', this.class()),
  )
}

@Directive({
  standalone: true,
  selector: '[ubCardTitle]',
  host: {
    '[class]': 'computedClass()',
  },
})
export class UbCardTitleDirective {
  readonly class = input<string>()
  protected computedClass = computed(() =>
    cn('text-2xl font-semibold leading-none tracking-tight', this.class()),
  )
}

@Directive({
  standalone: true,
  selector: '[ubCardDescription]',
  host: {
    '[class]': 'computedClass()',
  },
})
export class UbCardDescriptionDirective {
  readonly class = input<string>()
  protected computedClass = computed(() =>
    cn('text-sm text-muted-foreground', this.class()),
  )
}

@Directive({
  standalone: true,
  selector: '[ubCardContent]',
  host: {
    '[class]': 'computedClass()',
  },
})
export class UbCardContentDirective {
  readonly class = input<string>()
  protected computedClass = computed(() => cn('p-6 pt-0', this.class()))
}

@Directive({
  standalone: true,
  selector: '[ubCardFooter]',
  host: {
    '[class]': 'computedClass()',
  },
})
export class UbCardFooterDirective {
  readonly class = input<string>()
  protected computedClass = computed(() =>
    cn('flex items-center p-6 pt-0', this.class()),
  )
}
