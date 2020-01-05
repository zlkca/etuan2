import { throwError as observableThrowError, Observable ,  empty, of } from 'rxjs';
import { map, catchError, mergeMap, flatMap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';


import { environment } from '../../environments/environment';
import { Account, IAccount } from './account.model';

import { NgRedux } from '@angular-redux/store';
import { AccountActions } from './account.actions';
import { AuthService } from './auth.service';
import { EntityService } from '../entity.service';

export interface IAccessToken {
  'id'?: string;
  'ttl'?: number;
  'created'?: Date;
  'userId'?: string;
}

const API_URL = environment.API_URL;

@Injectable()
export class AccountService extends EntityService {
  url;
  DEFAULT_PASSWORD = '123456';

  constructor(
    private ngRedux: NgRedux<Account>,
    public authSvc: AuthService,
    public http: HttpClient
  ) {
    super(authSvc, http);
    this.url = super.getBaseUrl() + 'Accounts';
  }

  // d --- accountId, phone, lang: 'en' or 'zh'
  sendVerifyMsg(accountId: string, phone: string, lang: string): Observable<any> {
    const url = this.url + '/sendVerifyMsg';
    return this.doPost(url, {accountId: accountId, phone: phone, lang: lang});
  }

  verifyCode(phone: string, code: string): Observable<any> {
    const url = this.url + '/verifyCode';
    return this.doPost(url, {code: code, phone: phone});
  }

  signup(phone: string, verificationCode: string): Observable<any> {
    return this.http.post(this.url + '/signup', {phone: phone, verificationCode: verificationCode});
  }

  // login --- return string tokenId
  login(username: string, password: string): Observable<any> {
    const credentials = {
      username: username,
      password: password
    };
    return this.http.post(this.url + '/login', credentials);
  }

  loginByPhone(phone: string, verificationCode: string): Observable<any> {
    const credentials = {
      phone: phone,
      verificationCode: verificationCode
    };
    return this.http.post(this.url + '/loginByPhone', credentials);
  }

  logout(): Observable<any> {
    const state = this.ngRedux.getState();
    if (state && state._id) {
      this.ngRedux.dispatch({ type: AccountActions.UPDATE, payload: new Account() });
    }
    return this.http.post(this.url + '/logout', {});
  }

  // ------------------------------------
  // getCurrentAccount
  // return IAccount or null
  getCurrentAccount(): Observable<any> {
    const tokenId: string = this.authSvc.getAccessTokenId();
    if (tokenId) {
      return this.http.get(this.url + '/current?tokenId=' + tokenId);
    } else {
      return of(null);
    }
  }

  wechatLogin(authCode: string) {
    const url = this.url + '/wechatLogin?code=' + authCode;
    return this.http.get(url);
  }

}

