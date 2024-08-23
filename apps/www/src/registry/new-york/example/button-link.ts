import { Component } from "@angular/core";

import { UbButtonDirective } from "@/registry/new-york/ui/button.directive";

@Component({
    standalone: true,
    selector: "button-link-new-york",
    imports: [UbButtonDirective],
    template: `<button ubButton variant="link">Button</button>`,
})
export class ButtonLinkNewYork { }

export default ButtonLinkNewYork;
