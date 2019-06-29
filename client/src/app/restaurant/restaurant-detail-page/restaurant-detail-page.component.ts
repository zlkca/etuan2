import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';

import { ProductService } from '../../product/product.service';
import { RestaurantService } from '../../restaurant/restaurant.service';
import { Restaurant, IRestaurant } from '../restaurant.model';
import { IProduct, ICategory } from '../../product/product.model';
import { NgRedux } from '../../../../node_modules/@angular-redux/store';
import { IAppState } from '../../store';
import { PageActions } from '../../main/main.actions';
import { takeUntil } from '../../../../node_modules/rxjs/operators';
import { Subject } from '../../../../node_modules/rxjs';
import { MatDialog } from '../../../../node_modules/@angular/material';
import { QuitRestaurantDialogComponent } from '../quit-restaurant-dialog/quit-restaurant-dialog.component';
import { ICart } from '../../cart/cart.model';
import * as moment from 'moment';
import { IDelivery } from '../../delivery/delivery.model';
import { RangeService } from '../../range/range.service';
import { CategoryService } from '../../category/category.service';
// import { SharedService } from '../../shared/shared.service';
@Component({
  selector: 'app-restaurant-detail-page',
  templateUrl: './restaurant-detail-page.component.html',
  styleUrls: ['./restaurant-detail-page.component.scss']
})
export class RestaurantDetailPageComponent implements OnInit, OnDestroy {
  categories;
  groupedProducts: any = [];
  restaurant: IRestaurant;
  subscription;
  cart: ICart;
  onDestroy$ = new Subject<any>();
  locationSubscription;
  dow: number; // day of week
  delivery: IDelivery;
  products;

  constructor(
    private productSvc: ProductService,
    private categorySvc: CategoryService,
    private restaurantSvc: RestaurantService,
    private route: ActivatedRoute,
    private rx: NgRedux<IAppState>,
    private location: Location,
    private rangeSvc: RangeService,
    public dialog: MatDialog
  ) {
    const self = this;
    this.rx.dispatch({
      type: PageActions.UPDATE_URL,
      payload: 'restaurant-detail'
    });

    this.rx.select<IDelivery>('delivery').pipe(takeUntil(this.onDestroy$)).subscribe((t: IDelivery) => {
      self.delivery = t;
    });

    this.rx.select<ICart>('cart').pipe(takeUntil(this.onDestroy$)).subscribe((cart: ICart) => {
      this.cart = cart;
    });

    this.locationSubscription = this.location.subscribe((x) => {
      if (window.location.pathname.endsWith('restaurant/list')) {
        // window.history.forward();
        if (self.restaurant && self.cart && self.cart.items && self.cart.items.length > 0) {
          this.openDialog(self.restaurant.id, 'restaurant-list');
        }
      } else if (window.location.pathname.endsWith('order/history')) {
        if (self.restaurant && self.cart && self.cart.items && self.cart.items.length > 0) {
          this.openDialog(self.restaurant.id, 'order-history');
        }
      }
    });

    // this.rx.select('restaurant').pipe(
    //   takeUntil(this.onDestroy$)
    // ).subscribe((r: IRestaurant) => {
    //   this.restaurant = r;
    // });
  }

  ngOnInit() {
    const self = this;
    self.route.params.pipe(takeUntil(this.onDestroy$)).subscribe(params => {
      const merchantId = params['id'];
      self.restaurantSvc.findById(merchantId).pipe(takeUntil(this.onDestroy$)).subscribe(
        (restaurant: IRestaurant) => {

          self.rangeSvc.find().pipe(takeUntil(self.onDestroy$)).subscribe(ranges => {
            const origin = self.delivery.origin;
            if (origin) {
              const rs = self.rangeSvc.getAvailableRanges({ lat: origin.lat, lng: origin.lng }, ranges);
              restaurant.inRange = (rs && rs.length > 0) ? true : false;

              restaurant.fullDeliveryFee = self.cart.deliveryCost;
              restaurant.deliveryFee = self.cart.deliveryFee;
              restaurant.deliveryDiscount = self.cart.deliveryDiscount;
            }
            self.restaurant = restaurant;
          });
        },
        (err: any) => {
          self.restaurant = null;
        }
      );

      if (self.delivery && self.delivery.fromTime) {
        self.dow = moment(self.delivery.fromTime).day(); // 0 for sunday
      }

      const q = { merchantId: merchantId, dow: { $in: [self.dow.toString(), 'all'] } };
      self.productSvc.find(q).pipe(takeUntil(self.onDestroy$)).subscribe(products => {
        self.products = products;
      });
    });
  }

  ngOnDestroy() {
    this.locationSubscription.unsubscribe();
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  openDialog(merchantId: string, fromPage: string): void {
    const dialogRef = this.dialog.open(QuitRestaurantDialogComponent, {
      width: '300px',
      data: {
        title: '提示', content: '离开后将清空购物车。', buttonTextNo: '离开', buttonTextYes: '留下',
        merchantId: merchantId, fromPage: fromPage
      },
    });

    dialogRef.afterClosed().pipe(
      takeUntil(this.onDestroy$)
    ).subscribe(result => {
    });
  }

  onAfterCheckout(e) {

  }
}

