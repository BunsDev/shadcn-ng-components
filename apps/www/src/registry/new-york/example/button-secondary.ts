import { Component } from "@angular/core";

import { UbButtonDirective } from "@/registry/new-york/ui/button.directive";

@Component({
    standalone: true,
    selector: "button-secondary-new-york",
    imports: [UbButtonDirective],
    template: `<button ubButton variant="secondary">Button</button>`,
})
export class ButtonSecondaryNewYork { }

export default ButtonSecondaryNewYork;
