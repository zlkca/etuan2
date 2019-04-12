import { Component, OnInit, OnDestroy } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LocationService } from '../../location/location.service';
import { AccountService } from '../../account/account.service';
import { ILocationHistory, IPlace, ILocation, ILatLng, GeoPoint } from '../../location/location.model';
import { NgRedux } from '@angular-redux/store';
import { IAppState } from '../../store';
import { PageActions } from '../../main/main.actions';
import { SocketService } from '../../shared/socket.service';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../account/auth.service';
import { IPageAction } from '../main.reducers';
import { LocationActions } from '../../location/location.actions';
import { ILocationAction } from '../../location/location.reducer';
import { Subject } from '../../../../node_modules/rxjs';
import { takeUntil } from '../../../../node_modules/rxjs/operators';
import { ICommand } from '../../shared/command.reducers';
import { IDeliveryTime } from '../../delivery/delivery.model';
import { Account } from '../../account/account.model';
import { AccountActions } from '../../account/account.actions';
import { MatSnackBar } from '../../../../node_modules/@angular/material';
import { ContactService } from '../../contact/contact.service';
import { IContact, Contact } from '../../contact/contact.model';
import { IContactAction } from '../../contact/contact.reducer';
import { ContactActions } from '../../contact/contact.actions';

declare var google;

const APP = environment.APP;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  center: GeoPoint = { lat: 43.761539, lng: -79.411079 };
  restaurants;
  places: IPlace[];
  deliveryAddress = '';
  placeholder = 'Delivery Address';
  mapFullScreen = true;
  subscrAccount;
  account;
  bHideMap = false;
  bTimeOptions = false;
  orderDeadline = { h: 9, m: 30 };
  overdue;
  afternoon;
  deliveryTime: IDeliveryTime = { type: '', text: '' };
  contact;
  inRange = false;
  onDestroy$ = new Subject<any>();
  loading = false;

  constructor(
    private accountSvc: AccountService,
    private locationSvc: LocationService,
    private authSvc: AuthService,
    private contactSvc: ContactService,
    private socketSvc: SocketService,
    private router: Router,
    private route: ActivatedRoute,
    private rx: NgRedux<IAppState>,
    private snackBar: MatSnackBar
  ) {
    const self = this;

    this.route.queryParamMap.pipe(
      takeUntil(this.onDestroy$)
    ).subscribe(queryParams => {
      const code = queryParams.get('code');
      if (code) {
        this.loading = true;
        this.accountSvc.wechatLogin(code).pipe(
          takeUntil(this.onDestroy$)
        ).subscribe((data: any) => {
          if (data) {
            self.wechatLoginHandler(data);
          } else { // failed from shared link login
            // tslint:disable-next-line:max-line-length
            window.location.href = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx0591bdd165898739&redirect_uri=https://duocun.com.cn&response_type=code&scope=snsapi_userinfo&state=123#wechat_redirect';
          }
        });
      } else { // no code in router
        this.accountSvc.getCurrent().pipe(
          takeUntil(this.onDestroy$)
        ).subscribe(account => {
          self.account = account;
          self.socketSvc.init(this.authSvc.getAccessToken());
        });
      }
    });
  }

  wechatLoginHandler(data: any) {
    const self = this;
    self.authSvc.setUserId(data.userId);
    self.authSvc.setAccessToken(data.id);
    self.accountSvc.getCurrentUser().pipe(
      takeUntil(this.onDestroy$)
    ).subscribe((account: Account) => {
      if (account) {
        self.account = account;
        self.socketSvc.init(this.authSvc.getAccessToken());
        self.rx.dispatch({ type: AccountActions.UPDATE, payload: account });

        this.snackBar.open('', '微信登录成功。', {
          duration: 1000
        });
        self.loading = false;

        self.contactSvc.find({ where: { accountId: account.id } }).subscribe((r: IContact[]) => {
          if (r && r.length > 0) {
            self.contact = new Contact(r[0]);
            self.rx.dispatch<ILocationAction>({
              type: LocationActions.UPDATE,
              payload: self.contact.location
            });
            self.deliveryAddress = self.locationSvc.getAddrString(r[0].location); // set address text to input

            self.router.navigate(['main/filter']);
          }
        });
      } else {
        this.snackBar.open('', '微信登录失败。', {
          duration: 1000
        });
      }
    });
  }


  ngOnInit() {
    const self = this;
    this.places = []; // clear address list

    this.rx.dispatch<IPageAction>({
      type: PageActions.UPDATE_URL,
      payload: 'home'
    });
    this.rx.select('cmd').pipe(
      takeUntil(this.onDestroy$)
    ).subscribe((x: ICommand) => {
      if (x.name === 'clear-location-list') {
        this.places = [];
      }
    });
    this.rx.select('location').pipe(
      takeUntil(this.onDestroy$)
    ).subscribe((loc: ILocation) => {
      if (loc) {
        self.deliveryAddress = self.locationSvc.getAddrString(loc);
      }
    });
  }

  ngOnDestroy() {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  onAddressInputFocus(e?: any) {
    const self = this;
    this.places = [];
    if (this.account && this.account.id) {
      this.locationSvc.getHistoryLocations(this.account.id).then(a => {
        self.places = a;
      });
    }
  }

  onSelectPlace(e) {
    const r: ILocation = e.location;
    this.places = [];
    if (r) {
      this.rx.dispatch<ILocationAction>({
        type: LocationActions.UPDATE,
        payload: r
      });
      this.deliveryAddress = e.address; // set address text to input
      this.router.navigate(['main/filter']);
    }
  }

  onAddressChange(e) {
    const self = this;
    this.places = [];
    this.locationSvc.reqPlaces(e.input).subscribe((ps: IPlace[]) => {
      if (ps && ps.length > 0) {
        for (const p of ps) {
          p.type = 'suggest';
          self.places.push(p); // without lat lng
        }
      }
    });
  }

  onAddressClear(e) {
    this.deliveryAddress = '';
    this.places = [];
    this.onAddressInputFocus();
  }

  useCurrentLocation() {
    const self = this;
    self.places = [];
    this.locationSvc.getCurrentLocation().then(r => {
      self.deliveryAddress = self.locationSvc.getAddrString(r); // set address text to input

      self.rx.dispatch<ILocationAction>({
        type: LocationActions.UPDATE,
        payload: r
      });

      this.router.navigate(['main/filter']);
      // fix me!!!
      // if (self.account) {
      //   self.locationSvc.save({ userId: self.account.id, type: 'history',
      //     placeId: r.place_id, location: r, created: new Date() }).subscribe(x => {
      //   });
      // }
    },
      err => {
        console.log(err);
      });
  }

  showLocationList() {
    return this.places && this.places.length > 0;
  }

}
