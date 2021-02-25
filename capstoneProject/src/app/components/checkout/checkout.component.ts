import {Component, OnDestroy, OnInit} from "@angular/core";
import {CartItem} from "app/models/cart-item.model";
import {DeliveryOption} from "app/models/delivery-option.model";
import {Product} from "app/models/product.model";
import {ShoppingCart} from "app/models/shopping-cart.model";
import {DeliveryOptionsDataService} from "app/services/delivery-options.service";
import {ProductsDataService} from "app/services/products.service";
import {ShoppingCartService} from "app/services/shopping-cart.service";
import {ICreateOrderRequest, IPayPalConfig} from "ngx-paypal";
import {Observable, Subscription} from "rxjs";

interface ICartItemWithProduct extends CartItem {
  product: Product;
  totalCost: number;
}

@Component({
  selector: "app-checkout",
  styleUrls: ["./checkout.component.css"],
  templateUrl: "./checkout.component.html"
})
export class CheckoutComponent implements OnInit, OnDestroy {
  public deliveryOptions: Observable<DeliveryOption[]>;
  public cart: Observable<ShoppingCart>;
  public cartItems: ICartItemWithProduct[];
  public itemCount: number;
  public payPalConfig?: IPayPalConfig;
  public grossTotal: number;
  private products: Product[];
  private cartSubscription: Subscription;
  private success: boolean;
  private ShoppingCart: ShoppingCart;

  public constructor(private productsService: ProductsDataService,
                     private deliveryOptionService: DeliveryOptionsDataService,
                     private shoppingCartService: ShoppingCartService) {
  }

  public ngOnInit(): void {
    this.initConfig();
    this.deliveryOptions = this.deliveryOptionService.all();
    this.cart = this.shoppingCartService.get();
    this.cartSubscription = this.cart.subscribe((cart) => {
      this.itemCount = cart.items.map((x) => x.quantity).reduce((p, n) => p + n, 0);
      this.productsService.all().subscribe((products) => {
        this.products = products;
        this.cartItems = cart.items
          .map((item) => {
            const product = this.products.find((p) => p.id === item.productId);
            return {
              ...item,
              product,
              totalCost: product.price * item.quantity
            };
          });
      });
    });
  }

  public ngOnDestroy(): void {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
  }

  public emptyCart(): void {
    this.shoppingCartService.empty();
  }

  public getGrossTotal(): number {
    this.cart.subscribe((ShoppingCart) => this.ShoppingCart = ShoppingCart);
    this.grossTotal = this.ShoppingCart.grossTotal;
    return this.grossTotal;
  }

  public setDeliveryOption(option: DeliveryOption): void {
    this.shoppingCartService.setDeliveryOption(option);
  }

  private initConfig(): void {
    this.payPalConfig = {
      clientId: "sb",
      currency: "USD",
      createOrderOnClient: (data) => <ICreateOrderRequest> {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: this.getGrossTotal().toString(),
              breakdown: {
                item_total: {
                  currency_code: "USD",
                  value: this.getGrossTotal().toString()
                }
              }
            },
            items: [
              {
                name: "Enterprise Subscription",
                quantity: "1",
                category: "PHYSICAL_GOODS",
                unit_amount: {
                  currency_code: "USD",
                  value: this.getGrossTotal().toString(),
                },
              }
            ]
          }
        ]
      },
      advanced: {
        commit: "true"
      },
      style: {
        label: "paypal",
        layout: "vertical"
      },
      onApprove: (data, actions) => {
        console.log("onApprove - transaction was approved, but not authorized", data, actions);
        actions.order.get().then((details) => {
          console.log("onApprove - you can get full order details inside onApprove: ", details);
        });
      },
      onClientAuthorization: (data) => {
        console.log("onClientAuthorization - you should probably inform your server about completed transaction at this point", data);
        this.success = true;
      },
      onCancel: (data, actions) => {
        console.log("OnCancel", data, actions);
      },
      onError: (err) => {
        console.log("OnError", err);
      },
      onClick: (data, actions) => {
        console.log("onClick", data, actions);
      },
    };
  }
}
