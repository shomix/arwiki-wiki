import { 
  Component, OnInit, OnDestroy,
  Output, EventEmitter } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { ArweaveService } from '../../core/arweave.service';
import { Subscription } from 'rxjs';
import { 
  ArwikiTokenContract 
} from '../../core/arwiki-contracts/arwiki-token.service';
import { UtilsService } from '../../core/utils.service';
import { 
  ArwikiVotesService 
} from '../../core/arwiki-contracts/arwiki-votes.service';
import { 
  arwikiVersion 
} from '../../core/arwiki';
import { 
  AuthService 
} from '../../auth/auth.service';

@Component({
  selector: 'app-form-burn-vault',
  templateUrl: './form-burn-vault.component.html',
  styleUrls: ['./form-burn-vault.component.scss']
})
export class FormBurnVaultComponent implements OnInit, OnDestroy {
  maxLengthNote = 200;
  maxLengthAddress = 43;
  burnVaultForm = new FormGroup({
    target: new FormControl(
      '',
      [
        Validators.required,
        Validators.maxLength(this.maxLengthAddress),
        Validators.minLength(this.maxLengthAddress)
      ]
    ),
    notes: new FormControl(
      '', [Validators.required, Validators.maxLength(this.maxLengthNote)]
    )
  });
  loadingSubmit = false;
  @Output() working = new EventEmitter<boolean>();
  tx = '';
  error = '';
  submitVoteSubscription = Subscription.EMPTY;

  constructor(
    private _arweave: ArweaveService,
    private _tokenContract: ArwikiTokenContract,
    private _utils: UtilsService,
    private _tokenContractVotes: ArwikiVotesService,
    private _auth: AuthService) {
  }

  public get target() {
    return this.burnVaultForm.get('target')!;
  }

  public get notes() {
    return this.burnVaultForm.get('notes')!;
  }

  ngOnInit() {
  }

  ngOnDestroy() {
    this.submitVoteSubscription.unsubscribe();
  }


  onSubmit() {
    const target: string = this.target.value!.trim();
    const note: string = this.notes.value!.trim();

    if (!this._arweave.validateAddress(target)) {
      alert('Invalid arweave address!')
      return;
    }

    this.disableForm(true);

    const jwk = this._auth.getPrivateKey();
    this.submitVoteSubscription = this._tokenContractVotes
      .addVoteBurnVault(
        target,
        note,
        jwk,
        arwikiVersion[0])
      .subscribe({
        next: (res) => {
          let tx = '';
          if (res && Object.prototype.hasOwnProperty.call(res, 'originalTxId')) {
            tx = res.originalTxId;
          } else if (res && Object.prototype.hasOwnProperty.call(res, 'bundlrResponse') &&
            res.bundlrResponse && Object.prototype.hasOwnProperty.call(res.bundlrResponse, 'id')) {
            tx = res.bundlrResponse.id;
          }
          this.tx = tx;
          this.disableForm(false);
        },
        error: (error) => {
          this.error = 'Error creating vote!';
          this.disableForm(false);
          if (typeof error === 'string') {
            this._utils.message(error, 'error');
          } else if (error && Object.prototype.hasOwnProperty.call(error, 'message')) {
            this._utils.message(error.message, 'error');
          }
          console.error('newVote', error);
        }
      });
  }

  formatBlocks(len: number): string {
    return this._arweave.formatBlocks(len);
  }

  disableForm(disable: boolean) {
    if (disable) {
      this.target.disable();
      this.notes.disable();
      this.working.emit(true);
      this.loadingSubmit = true;
    } else {
      this.target.enable();
      this.notes.enable();
      this.working.emit(false);
      this.loadingSubmit = false;
    }
  }

}
