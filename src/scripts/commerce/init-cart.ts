import { initCartStore } from '@scripts/commerce/cart-store';
import { initCartUi } from '@scripts/commerce/cart-ui';
import { initCartController } from '@scripts/commerce/cart-controller';

initCartUi();
initCartController();
void initCartStore();
