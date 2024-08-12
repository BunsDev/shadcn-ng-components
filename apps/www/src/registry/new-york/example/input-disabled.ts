import { Component } from "@angular/core";

import { UbInputDirective } from "@/registry/new-york/ui/input.directive";

@Component({
  standalone: true,
  imports: [UbInputDirective],
  template: ` <input disabled ubInput type="text" placeholder="Email" /> `,
})
export class InputDisabledDemoComponent {}

export default InputDisabledDemoComponent;
