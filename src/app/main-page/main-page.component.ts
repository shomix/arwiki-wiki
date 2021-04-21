import { Component, OnInit, OnDestroy } from '@angular/core';
import { UserSettingsService } from '../core/user-settings.service';
import { ArwikiCategoriesContract } from '../arwiki-contracts/arwiki-categories';
import { Subscription, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ArweaveService } from '../core/arweave.service';
import { ArwikiSettingsContract } from '../arwiki-contracts/arwiki-settings';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ArwikiQuery } from '../core/arwiki-query';
import { AuthService } from '../auth/auth.service';
import { ActivatedRoute } from '@angular/router';
import { getVerification } from "arverify";

@Component({
  selector: 'app-main-page',
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss']
})
export class MainPageComponent implements OnInit, OnDestroy {
	categories: any = {};
	categoriesSlugs: string[] = [];
	categoriesSubscription: Subscription = Subscription.EMPTY;
	defaultTheme: string = '';
	loading: boolean = false;
  appName: string = '';
  // appLogoLight: string = './assets/img/arweave-light.png';
  appLogoLight: string = '';
  // appLogoDark: string = './assets/img/arweave-dark.png';
  appLogoDark: string = '';
  appSettingsSubscription: Subscription = Subscription.EMPTY;
  loadingLogo: boolean = false;
  loadingLatestArticles: boolean = false;
  latestArticles: any[] = [];
  latestArticlesData: any;
  arwikiQuery: ArwikiQuery|null = null;
  pagesSubscription: Subscription = Subscription.EMPTY;
  routeLang: string = '';
  baseURL = this._arweave.baseURL;
  arverifyProcessedAddressesMap: any = {};

  constructor(
    private _userSettings: UserSettingsService,
    private _categoriesContract: ArwikiCategoriesContract,
    private _arweave: ArweaveService,
    private _arwikiSettings: ArwikiSettingsContract,
    private _snackBar: MatSnackBar,
    private _auth: AuthService,
    private _route: ActivatedRoute
  ) { }

  async ngOnInit() {
  	this.getDefaultTheme();
  	this.loading = true;
    this.loadingLogo = true;
    this.loadingLatestArticles = true;
    // Init ardb instance
    this.arwikiQuery = new ArwikiQuery(this._arweave.arweave);
    this.routeLang = this._route.snapshot.paramMap.get('lang')!;

    // Get categories (portals)
    this.categoriesSubscription = this._categoriesContract.getState()
      .subscribe({
      	next: (data) => {
      		this.categories = data;
      		this.categoriesSlugs = Object.keys(this.categories);
      		this.loading = false;
      	},
      	error: (error) => {
      		console.log('error categories', error);
      		this.loading = false;
      	},
    	});

    // Get logo 
    this.appSettingsSubscription = this._arwikiSettings
      .getState()
      .subscribe({
        next: (state) => {
          this.appName = state.app_name;
          this.appLogoLight = `${this._arweave.baseURL}${state.main_logo_light}`;
          this.appLogoDark = `${this._arweave.baseURL}${state.main_logo_dark}`;
          this.loadingLogo = false;
        },
        error: (error) => {
          this.message(error, 'error');
          this.loadingLogo = false;
        }
      });

    // Get latest articles 
    const numArticles = 10;
    let networkInfo;
    let maxHeight = 0;
    try {
      networkInfo = await this._arweave.arweave.network.getInfo();
      maxHeight = networkInfo.height;
    } catch (error) {
      this.message(error, 'error');
      return;
    }
    this.pagesSubscription = this.getLatestArticles(
        numArticles, this.routeLang, maxHeight
      ).subscribe({
      next: async (pages) => {
        const latestPages: any = [];
        for (let p of pages) {
          const title = this.searchKeyNameInTags(p.node.tags, 'Arwiki-Page-Title');
          const slug = this.searchKeyNameInTags(p.node.tags, 'Arwiki-Page-Slug');
          const category = this.searchKeyNameInTags(p.node.tags, 'Arwiki-Page-Category');
          const img = this.searchKeyNameInTags(p.node.tags, 'Arwiki-Page-Img');
          const owner = p.node.owner.address;
          const id = p.node.id;
          const block = p.node.block;
          
          latestPages.push({
            title: title,
            slug: slug,
            category: category,
            img: img,
            owner: owner,
            id: id,
            block: block
          });
        }
        this.latestArticles = latestPages;
        this.loadingLatestArticles = false;
        this.latestArticlesData = {};

        for (let p of latestPages) {
          let data = await this._arweave.arweave.transactions.getData(
            p.id, 
            {decode: true, string: true}
          );
          this.latestArticlesData[p.id] = data;
        }

        // Verify addresses 
        // Validate owner address with ArVerify
        this.arverifyProcessedAddressesMap = {};
        for (let p of latestPages) {
          // Avoid duplicates
          if (
            Object.prototype.hasOwnProperty.call(
              this.arverifyProcessedAddressesMap, 
              p.owner
            )
          ) {
            continue;
          }
          const arverifyQuery = await this.getArverifyVerification(p.owner);
          this.arverifyProcessedAddressesMap[p.owner] = arverifyQuery;
        }
      },
      error: (error) => {
        this.message(error, 'error');
        this.loadingLatestArticles = false;
      }
    });
  }

  /*
  *  @dev return an observable with the latest articles
  */
  getLatestArticles(numArticles: number, langCode: string, height: number) {
    return this._arwikiSettings.getAdminList().pipe(
      switchMap((adminList) => {
        return this.arwikiQuery!.getVerifiedPages(adminList, langCode, numArticles, height);
      }),
      switchMap((pages) => {
        const txIds: any = [];
        for (let p of pages) {
          const pageId = this.searchKeyNameInTags(p.node.tags, 'Arwiki-Page-Id');  
          txIds.push(pageId);
        }
        return this.arwikiQuery!.getTXsData(txIds);
      })
      
    );
  }


  getDefaultTheme() {
  	this.defaultTheme = this._userSettings.getDefaultTheme();
    this._userSettings.defaultThemeStream.subscribe(
    	(theme) => {
    		this.defaultTheme = theme;
    	}
    );
  }

  ngOnDestroy() {
  	if (this.categoriesSubscription) {
  		this.categoriesSubscription.unsubscribe();
  	}
    if (this.appSettingsSubscription) {
      this.appSettingsSubscription.unsubscribe();
    }
  }

  /*
  *  Custom snackbar message
  */
  message(msg: string, panelClass: string = '', verticalPosition: any = undefined) {
    this._snackBar.open(msg, 'X', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: verticalPosition,
      panelClass: panelClass
    });
  }



  getSkeletonLoaderAnimationType() {
  	let type = 'progress';
  	if (this.defaultTheme === 'arwiki-dark') {
  		type = 'progress-dark';
  	}
  	return type;
  }

  getSkeletonLoaderThemeNgStyle() {
  	let ngStyle: any = {
  		'height.px': '30',
  		'width': '100%'
  	};
  	if (this.defaultTheme === 'arwiki-dark') {
  		ngStyle['background-color'] = '#3d3d3d';
  	}

  	return ngStyle;
  }

  getSkeletonLoaderThemeNgStyle2() {
    let ngStyle: any = {
      'height.px': '120',
      'width.px': '120',
      'float': 'left',
      'margin-top.px': '40',
      'margin-right.px': '30'
    };
    if (this.defaultTheme === 'arwiki-dark') {
      ngStyle['background-color'] = '#3d3d3d';
    }

    return ngStyle;
  }


  getSkeletonLoaderThemeNgStyleTitleArticle() {
    let ngStyle: any = {
      'height.px': '36',
      'width': '70%',
    };
    if (this.defaultTheme === 'arwiki-dark') {
      ngStyle['background-color'] = '#3d3d3d';
    }

    return ngStyle;
  }

  getSkeletonLoaderThemeNgStylePLine() {
    let ngStyle: any = {
      'height.px': '20',
      'width': '100%',
    };
    if (this.defaultTheme === 'arwiki-dark') {
      ngStyle['background-color'] = '#3d3d3d';
    }

    return ngStyle;    
  }

  searchKeyNameInTags(_arr: any[], _key: string) {
    let res = '';
    for (const a of _arr) {
      if (a.name === _key) {
        return a.value;
      }
    }
    return res;
  }

  sanitizeMarkdown(_s: string, _maxLength: number = 250) {
    _s = _s.replace(/[#*=\[\]]/gi, '')
    let res: string = `${_s.substring(0, _maxLength)} ...`;
    return res;
  }

  
  sanitizeImg(_img: string) {
    let res: string = _img.indexOf('http') >= 0 ?
      _img :
      _img ? `${this.baseURL}${_img}` : '';
    return res;
  }


  async getArverifyVerification(_address: string) {
    const verification = await getVerification(_address);

    return ({
      verified: verification.verified,
      icon: verification.icon,
      percentage: verification.percentage
    });
  }

  timestampToDate(_time: number) {
    let d = new Date(_time * 1000);
    return d;
  }

}
