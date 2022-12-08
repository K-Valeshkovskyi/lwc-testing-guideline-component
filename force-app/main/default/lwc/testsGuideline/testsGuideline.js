import {
  LightningElement,
  api,
  track,
  wire
} from 'lwc';
import LightningConfirm from 'lightning/confirm';


import {
  getCountries,
  evtParams,
  copy
} from './utils';
import labels from './labels';

// expired already so don't count on it
const testApi = 'PCWCK-KJ6SG-MB4G8-RN6AQ';





import {
  ShowToastEvent
} from "lightning/platformShowToastEvent";
import getContactList from '@salesforce/apex/TestsGuidelineController.getContactList';
import getAccountList from '@salesforce/apex/TestsGuidelineController.getAccountList';

import {
  refreshApex
} from '@salesforce/apex';

import { getObjectInfo } from 'lightning/uiObjectInfoApi';



import { createRecord, deleteRecord, getRecord, updateRecord } from 'lightning/uiRecordApi';

import {
  reduceErrors
} from 'c/ldsUtils';

import ACCOUNT_OBJECT from '@salesforce/schema/Account';
import ID_FIELD from '@salesforce/schema/Account.Id';
import NAME_FIELD from '@salesforce/schema/Account.Name';

export default class TestsGuideline extends LightningElement {
  labels = labels;

  @track countries = [];
  matches = [];

  config = {
    apikey: null,
    organisation: '',
    addressline1: 'a',
    addressline2: 'b',
    addressline3: 'c',
    addressline4: 'd',
    posttown: '',
    county: '',
    postcode: ''
  }

  selectedCountry = '';
  searchTerm = '';
  addresslines = 0;
  page = 0;
  addresses = {};

  _postcoderApiKey;
  @api
  get postcoderApiKey() {
    return this._postcoderApiKey;
  }
  set postcoderApiKey(v) {
    this._postcoderApiKey = v;
  }

  @api required = false;
  @api label = '';
  @api value = '';

  @track isLoading = false;

  @track rerender = false;



  get endpoint() {
    return 'https://ws.postcoder.com/pcw/' + this.config.apikey + '/address/';
  }

  get disabledSearch() {
    return (!this.selectedCountry || !this.searchTerm)
  }

  get hasResults() {
    return this.matches.length > 1;
  }

  get getPage() {
    return this.page + 1
  }

  get hasValue() {
    return !!this.value
  }

  get hasCountries() {
    return this.countries.length > 0
  }

  doRerender() {
    this.rerender = !this.rerender;
  }

  connectedCallback() {

    // As discussed, this shouldn't initialize if parent component ( RDF ) already has the value
    if (this.value) return;

    this.countries = getCountries();
    this.init();
  }

  init() {
    if (!this.postcoderApiKey)
      this._postcoderApiKey = testApi;
    this.config.apikey = this.postcoderApiKey;

    this.addresslines = 0;
    for (let i = 1; i <= 4; i++) {
      if (this.config['addressline' + i !== '']) {
        this.addresslines++;
      }
    }
  }

  handleSelectCountry(e) {
    this.selectedCountry = e.detail.value;
  }

  handleUpdateSearch(e) {
    this.searchTerm = e.target.value;
  }

  handleKeydown(e) {
    if (e.key === 'Enter') {
      this.handleSearch();
    }
  }

  async handleSearch() {
    if (!this.selectedCountry || !this.searchTerm) return;
    this.isLoading = true;
    const fetchStr = this.endpoint +
      `${this.selectedCountry.toUpperCase()}/${this.searchTerm.split(' ').join('%20')}` +
      `?format=json&lines=${this.addresslines}&include=postcode&exclude=organisation,country` +
      `&page=${this.page}&addtags=latitude,longitude`;

    fetch(fetchStr).then(resp => resp.json())
      .then(results => {
        let res = copy(results);
        res = res.map((i, index) => {
          // Some requests returns multiple addresses with same summaryline
          i.value = i.summaryline + '_' + index;
          i.label = i.summaryline;
          return i;
        });
        this.matches = res;
        if (this.matches.length === 1) {
          this.handleSelectAddress({
            detail: {
              value: this.matches[0].value
            }
          });
        }
        if (!this.matches.length) {
          this.showNoMatchesPrompt();
        }

      }).catch(err => {
        this.matches = [];
        console.log(err);

      }).finally(() => {
        this.isLoading = false;
        this.doRerender();
      })
  }

  async showNoMatchesPrompt() {
    const result = await LightningConfirm.open({
      message: 'No matches found. Would you like to fill address manually?',
      variant: 'headerless',
    });
    if (result) {
      this.handleNoMatches();
    }
  }

  handleSelectAddress(e) {
    let selectedAddress = this.matches.find(i => i.value === e.detail.value);
    this.dispatchEvent(new CustomEvent('addressselected', {
      ...evtParams,
      detail: {
        value: selectedAddress
      }
    }))
  }

  handleNoMatches() {
    this.dispatchEvent(new CustomEvent('showstandardaddress', {
      ...evtParams,
      detail: null
    }))
  }

  /** ALL the rest of functionality is here to be able to create different tests */

  handleToastCall() {
    this.dispatchEvent(
      new ShowToastEvent({
        title: 'Test toast',
        message: 'Test toast message',
        variant: 'success'
      })
    );
  }

  @wire(getContactList) contacts;


  wiredAccountsResult;
  accounts = [];
  singleAccountRecordId = null;

  @wire(getAccountList)
  wiredAccounts(result) {
    this.wiredAccountsResult = result;
    if (result.data && result.data.length) {
      this.accounts = result.data;
      this.singleAccountRecordId = result.data[1].Id;
    }
    if (result.error) {
      if (this.deleteFlow)
        this.deleteFlow = false;
      this.deleteRecordError = result.error.body;
      this.dispatchEvent(
        new ShowToastEvent({
          title: 'Error deleting record',
          message: result.error.body,
          variant: 'error'
        })
      );
    }
  }


  get hasContacts() {
    return this.contacts && this.contacts.data
  }
  get hasAccounts() {
    return this.accounts.length
  }

  objectApiName;

  @wire(getObjectInfo, {
    objectApiName: '$objectApiName'
  })
  objectInfo;

  handleBtnClick() {
    this.objectApiName = this.template.querySelector('[data-id="get-object-info-input"').value;
  }

  get objectInfoStr() {
    return this.objectInfo ? JSON.stringify(this.objectInfo.data, null, 2) : '';
  }

  get objectErrorStr() {
    return this.objectInfo ? JSON.stringify(this.objectInfo.error, null, 2) : '';
  }


  accountId;

  name = '';

  handleNameChange(event) {
    this.accountId = undefined;
    this.name = event.target.value;
  }

  createAccount() {
    const fields = {};
    fields[NAME_FIELD.fieldApiName] = this.name;
    const recordInput = {
      apiName: ACCOUNT_OBJECT.objectApiName,
      fields
    };
    createRecord(recordInput)
      .then((account) => {
        this.accountId = account.id;
        this.dispatchEvent(
          new ShowToastEvent({
            title: 'Success',
            message: 'Account created',
            variant: 'success'
          })
        );
      })
      .catch((error) => {
        this.dispatchEvent(
          new ShowToastEvent({
            title: 'Error creating record',
            message: reduceErrors(error).join(', '),
            variant: 'error'
          })
        );
      });
  }


  deleteRecordError = null;
  deleteFlow = false;
  get hasDeleteRecordError() {
    return this.deleteRecordError !== null;
  }
  deleteAccount(event) {
    const recordId = event.target.dataset.recordid;
    this.deleteFlow = true;
    deleteRecord(recordId)
      .then(() => {
        this.deleteFlow = false;
        this.dispatchEvent(
          new ShowToastEvent({
            title: 'Success',
            message: 'Account deleted',
            variant: 'success'
          })
        );
        // Now we need to update a UI account list, as we know that deletion was successful.
        /** 
         * First way is to use a 'refreshApex' callout
         * For doing this we need to 
         * 1. import { refreshApex }
         * 2. bind the result of @wired call to a template variable.
         *    Take a closer look at the 'wiredAccountsResult' definition
         */
        refreshApex(this.wiredAccountsResult);
        // It will call the @wire method again and get the refreshed data. And rerender the template
        // And one more thing. 'refreshApex' will send us to a @wire call.
        // And if we get an error there - the 'catch' block here in the flow won't work
        // We have to handle it there






        // as an alternative we can work with front data - filter existing list and update the template
        // this.accounts = this.accounts.filter( i => i.Id !== recordId);
        // this.doRerender();

      })
      .catch((error) => {
        this.deleteRecordError = error.body;
        this.dispatchEvent(
          new ShowToastEvent({
            title: 'Error deleting record',
            message: error.body,
            variant: 'error'
          })
        );
      });
  }




  singleAccountResult;
  @track singleAccount = null;

  updateRecordError = null;
  updateFlow = false;

  
  get hasSingleAccount() {
    return this.singleAccount !== null;
  }

  get hasUpdateRecordError() {
    return this.updateRecordError !== null;
  }
  
  // we need a recordId here. 
  // In real world it should be done other way but 
  // this component allows us to get one from accountList above
  @wire(getRecord, { recordId: '$singleAccountRecordId', fields: ['Account.Id', 'Account.Name'] })
  wiredSingleAccount(result) {
    this.singleAccountResult = result;

    // When we get a data from wired function - we can't update it directly
    // as it's just a readonly pointer to a record in SF. And Force doesn't allow us to do this.
    // So we make a local copy 
    if (result.data) {
      this.singleAccount = {};
      const record = copy(result.data);
      for (let key in record.fields) {
        if( Object.prototype.hasOwnProperty.call(record.fields, key)) {
          this.singleAccount[key] = record.fields[key].value;
        }
      }
    }

    if (result.error) {
      if (this.updateFlow)
        this.updateFlow = false;
      this.updateRecordError = result.error.body;
      this.dispatchEvent(
        new ShowToastEvent({
          title: 'Error updating record',
          message: result.error.body,
          variant: 'error'
        })
      );
    }
  }

  handleUpdateName(e) {
    this.singleAccount.Name = e.target.value;
  }
  updateAccount() {
    this.updateFlow = true;
    const fields = {};
    fields[NAME_FIELD.fieldApiName] = this.singleAccount.Name;
    fields[ID_FIELD.fieldApiName] = this.singleAccount.Id;

    const recordInput = {
      fields
    };
    updateRecord(recordInput)
      .then(() => {
        this.updateFlow = false;

        refreshApex(this.singleAccountResult);

        this.dispatchEvent(
          new ShowToastEvent({
            title: 'Success',
            message: 'Account updated',
            variant: 'success'
          })
        );
      }).catch(error => {
        this.updateRecordError = error.body;
        this.dispatchEvent(
          new ShowToastEvent({
            title: 'Error updating record',
            message: error.body,
            variant: 'error'
          })
        );
      })
  }


  explicitAccounts = [];
  explicitAccountsCalloutError = null;

  get gotAccounts(){
    return this.explicitAccounts.length > 0
  }

  async getAccounts(){
    try{
      this.explicitAccountsCalloutError = null;
      let result = await getAccountList();
      this.explicitAccounts = ( result ? result : [] );
      if (this.explicitAccounts.length === 0) {
        this.dispatchEvent(
          new ShowToastEvent({
            title: 'Error',
            message: 'No accounts found',
            variant: 'error'
          })
        );
      }
    } catch(error){
      this.explicitAccountsCalloutError = error;
    }
  }
}