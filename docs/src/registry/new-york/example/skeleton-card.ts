import { UbSkeletonDirective } from '@/registry/new-york/ui/skeleton'

import { Component } from '@angular/core'

@Component({
  standalone: true,
  selector: 'sekeleton-card-new-york',
  imports: [UbSkeletonDirective],
  template: `
    <div class="flex flex-col space-y-3">
        <div ubSkeleton class="h-[125px] w-[250px] rounded-xl"></div>
        <div class="space-y-2">
        <div ubSkeleton class="h-4 w-[250px]"></div>
        <div ubSkeleton class="h-4 w-[200px]"></div>
        </div>
    </div>
    `,
})
export default class SekeletonCardNewYork { }
