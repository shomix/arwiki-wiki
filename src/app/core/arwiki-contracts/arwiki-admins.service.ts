import { Injectable } from '@angular/core';
import { ArwikiTokenContract } from './arwiki-token.service';
import { WarpContractsService } from '../warp-contracts.service';
import { Observable, map } from 'rxjs';
import { ArweaveService } from '../arweave.service';

@Injectable({
  providedIn: 'root'
})
export class ArwikiAdminsService {
  private _adminList: string[] = [];

  constructor(
    private _arwikiToken: ArwikiTokenContract,
    private _warp: WarpContractsService,
    private _arweave: ArweaveService,) { }

  /*
  *  @dev Get only the admin list from full state contract
  */
  getAdminList(reload = false): Observable<string[]> {
    return this._arwikiToken.getState(reload).pipe(
      map((_state: any) => {
        this._adminList = Object.keys(_state.roles).filter((address) => {
          return _state.roles[address].toUpperCase() === 'MODERATOR';
        });

        return [...this._adminList];
      })
    );
  }

  /*
  *  @dev Get only the admin list from full state contract
  */
  isAdmin(address: string, reload=false): Observable<boolean> {
    return this.getAdminList(reload).pipe(
      map( (admin_list: string[]) => {
        return Array.prototype.indexOf.call(admin_list, address) >= 0; 
      })
    );
  }
}