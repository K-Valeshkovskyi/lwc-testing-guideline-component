// BEFORE ANY TESTING
// Be sure you installed the test packages using the command
// sfdx force:lightning:lwc:test:setup

// This will also install lwc-linter.


// importing the component to test
import lwcTemplate from 'c/testsGuideline';
const componentName = 'c-tests-guideline';

/** START OF PREPARATIONS */

import { getCountries } from '../utils';

import {  
  createComponent,
  clearBodyAfterTest, 
  flushPromises,
  getClassString
} from './testUtils';


import { 
  mockFetchData, 
  mockGetContactList,  
  mockGetAccountList, 
  mockAccountRecord, 
  mockLDSCreateRecord,
  mockLDSDeleteRecord,
  mockGetSingleAccount } from './mockedData'; 


import LightningConfirm from 'lightning/confirm';
jest.mock('lightning/confirm');

import { ShowToastEventName } from 'lightning/platformShowToastEvent';

import getContactList from '@salesforce/apex/TestsGuidelineController.getContactList';
jest.mock( 
  '@salesforce/apex/TestsGuidelineController.getContactList', 
  () => {
    const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true } );

// As we use 'getAccountList' both for wire and for explicit callut in the tests
// It is necessary to define different aliases as jest have to mock them differently
import getAccountList           from '@salesforce/apex/TestsGuidelineController.getAccountList';
import imperativeGetAccountList from '@salesforce/apex/TestsGuidelineController.getAccountList';

// Mocking @wire Apex method call
jest.mock(
  '@salesforce/apex/TestsGuidelineController.getAccountList',
  () => {
    const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
    return { default: createApexTestWireAdapter(jest.fn()) };
  }, 
  { virtual: true } );

// Mocking imperative Apex method call
// Notice that 'imperativeGetAccountList' is not really exist in 'TestsGuidelineController'
// But jest is now working with the alias we defined
jest.mock(
  '@salesforce/apex/TestsGuidelineController.imperativeGetAccountList', () => {
    return { default: jest.fn() };
  }, { virtual: true }
);




/**
 * generic imports here caused by linter error telling
 *   "getObjectInfo" and all the CRUD methods of 'lightning/uiRecordApi' are wire adapters and can only be used via the @wire decorator.
 * if importing and trying to use method directly
 * 
 * That makes sense in component itself but in tests we have no other option to trigger
 * the method at the time we expect it to trigger itself in real world
 */
import * as uiObjectInfoApi from 'lightning/uiObjectInfoApi';
const getObjectInfo = uiObjectInfoApi.getObjectInfo;

import * as uiRecordApi from 'lightning/uiRecordApi';
const getRecord = uiRecordApi.getRecord;
/**
 * All the rest methods doesn't use 'emit' so can be imported as usual
 */
import { createRecord, deleteRecord, updateRecord } from 'lightning/uiRecordApi';




import { createElement } from 'lwc';


/** END OF PREPARATIONS */

describe('Testing ' + componentName, () => { 



  /**
   * Inside any of 'describe' block we use 'it' blocks to test what we want
   * because this is one function, in the end of each 'it' block we have the
   * component with the changes we did to test the behavior
   * Using 'afterEach' block allows us to do some cleaning.
   * 
   * For example, here we clear the test-DOM after each test statement
   * and create it from the 'config' in the beginning of each statement
   */
  afterEach( () => {
    clearBodyAfterTest()
  });
  

  describe('Testing the main component flow', () => { 
    /**
     * Let's test if we can create a component using the imported lwcTemplate
     */
    it('creates correct component', () => {
      // This is a virtual component initialization block.
        const component = createElement(componentName, {
          is: lwcTemplate
        });
        document.body.appendChild(component);

        // and the check itself
      expect(component.tagName.toLowerCase()).toBe(componentName);
    });

    
    /**
     * Let's test if we can read the public params
     */
    it('allows to check its @api params', () => {
      const { component } = createComponent({componentName, lwcTemplate});
      expect(component.postcoderApiKey).toBe('PCWCK-KJ6SG-MB4G8-RN6AQ');
    });

    
    /**
     * Let's test if we can write to the public params.
     * use case - receiving the params from parent component
     */
    it('allows to init with updated @api params', () => {
      const { component } = createComponent({componentName, lwcTemplate, postcoderApiKey: 'test API key'});
      expect(component.postcoderApiKey).toBe('test API key');
    });


    /**
     * Let's check if we are getting the component content.
     * The component won't render 
     * 1. if there is no country list, so if there is a component childNodes - the connectedCallback is working
     * 2. if there is value coming from parent ( in test this is config param )
     */
    it( 'does its connectedCallback on initialization', () => {
      const { template } = createComponent({componentName, lwcTemplate});
      expect(template.children.length > 0).toBeTruthy();
    });

    it( 'does not render when any value is coming from parent', () => {
      const { template } = createComponent({componentName, lwcTemplate, value: 'test'});
      expect(template.children.length === 0).toBeTruthy();
    });


    /**
     * During test we can check the public (@api) params at any time.
     * This also means we can work with child components
     * check their @api parameters
     * trigger their @api methods
     * or make them dispatch CustomEvents 
     */
    it( 'shows us the child component params', () => {
      const { component, template } = createComponent({componentName, lwcTemplate});
      // checking the component @api required param
      expect(component.required).toBe(false);

      // checking the child multiselect @api options param. We send there the countries.
      const countries = getCountries();
      const multiselectOptions = template.querySelector('c-lwc-multiselect').options;

      expect(multiselectOptions.length).toBe(countries.length);
    });



    /**
     * 
     * This test is going through main component flow
     * Selecting the country from the picklist
     * Entering the postcode into input
     * Fetching the API for matches to selected and entered values
     * Selecting the address from matches
     * And dispatching selected to parent component
     */
    it( 'the main flow works',  async () => {
      let { component, template } = createComponent({componentName, lwcTemplate});
      
      // Main flow uses fetch to get the data from PostCoder API
      // We'll override the fetch function to get mocked data instead of real fetch
      global.fetch = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockFetchData.manyResults),
        })
      );

      // Main flow should trigger 'addressselected' CustomEvent in the end
      // Let's add listener for this
      const addressSelectedHandler = jest.fn();
      component.addEventListener('addressselected', addressSelectedHandler);
      
      // We have only one button here in the component so it is easy to find it
      let button = template.querySelector('lightning-button[data-id="fetch-button"');

      // First of all - the button should not fetch anything when there is no 
      // searchTerm or selectedCountry (empty values by default)

      // Pretending to click a button
      expect(global.fetch).toHaveBeenCalledTimes(0);
      button.click();
      expect(global.fetch).toHaveBeenCalledTimes(0);
      
      // Ok. Now let's pretend we've selected a country
      let countryPicklist = template.querySelector('c-lwc-multiselect[data-id="country-select"]');
      countryPicklist.value = countryPicklist.options[0].value;
      countryPicklist.dispatchEvent(new CustomEvent('select', { detail: { value: countryPicklist.value } }));

      // Trying to click button again
      button.click();
      expect(global.fetch).toHaveBeenCalledTimes(0);

      // Good. Now let's enter a value in the input
      let input = template.querySelector('lightning-input');
      input.value = '65652';
      input.dispatchEvent(new InputEvent('change', { target: {value: input.value} }));

      // And only now the button should be working and call the fetch
      button.click();
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // Second picklist was hidden until now with 'if:true' logic and we can check that
      let addressPicklist = template.querySelector('c-lwc-multiselect[data-id="address-select"]');
      expect(addressPicklist).toBeNull();

      // Wait for fetch resolving and return its 'no data' response
      await flushPromises();

      // Fetch was done, the logic now will update the values and rerender the template.
      await flushPromises();
      
      // Now the template must be updated as we've got the results and one more multiselect should be shown
      addressPicklist = template.querySelector('c-lwc-multiselect[data-id="address-select"]');
      expect(addressPicklist).not.toBeNull();

      // Last step - selecting the value in address-multiselect.
      // Until now 'addressselected' shouldn't be fired
      expect(addressSelectedHandler).toHaveBeenCalledTimes(0);
      
      addressPicklist.value = addressPicklist.options[0].value;
      addressPicklist.dispatchEvent(new CustomEvent('select', { detail: { value: addressPicklist.value } }));
      
      expect(addressSelectedHandler).toHaveBeenCalledTimes(1);
    });


    /**
     * Great, we tested the main flow.
     * But it can be there will be no matches in fetch
     * Let's test that case
     */
    it( 'handles empty fetch response',  async () => {
      // Main functionality is same, the difference is only in the response
      let { component, template } = createComponent({componentName, lwcTemplate});
      
      // Here we will return mocked empty response
      global.fetch = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockFetchData.noData),
        })
      );

      const promptSubmitHandler = jest.fn();
      component.addEventListener('showstandardaddress', promptSubmitHandler);
      
      let button = template.querySelector('lightning-button[data-id="fetch-button"');

      let countryPicklist = template.querySelector('c-lwc-multiselect[data-id="country-select"]');
      countryPicklist.value = countryPicklist.options[0].value;
      countryPicklist.dispatchEvent(new CustomEvent('select', { detail: { value: countryPicklist.value } }));

      let input = template.querySelector('lightning-input');
      input.value = '65652';
      input.dispatchEvent(new InputEvent('change', { target: {value: input.value} }));

      // Now. After the fetch and getting no data the main logic should show LightningConfirm prompt.
      // And dispatch 'showstandardaddress' CustomEvent if user confirmed that.
      // We've added a listener for that event eariler and for now it shouldn't be triggered
      expect(promptSubmitHandler).toHaveBeenCalledTimes(0);

      // Here we replace LightningConfirm.open with 'No' response
      LightningConfirm.open = jest.fn().mockResolvedValue(false);

      button.click();
      
      
      // Wait for fetch resolving and return its 'no data' response
      await flushPromises();

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // As we have no data - there is a LightningConfirm opened and automatically closed
      // because we asked it to send back 'No' response
      await flushPromises();

      // We had one call
      expect(LightningConfirm.open.mock.calls).toHaveLength(1);
      
      // We answered 'No' so result is 'false'
      expect (await LightningConfirm.open.mock.results[0].value).toBeFalsy();
      
      // As we disagreed with the prompt our CustomEvent still didn't fire
      expect(promptSubmitHandler).toHaveBeenCalledTimes(0);

      
      // Let's do this again

      
      // But now we pretend user saying 'Yes'
      LightningConfirm.open = jest.fn().mockResolvedValue(true);
      // we reassigned LightningConfirm.open so its calls count is 0 again
      
      button.click();
      expect(global.fetch).toHaveBeenCalledTimes(2);

      
      // Wait for fetch resolving and return its 'no data' response
      await flushPromises();

      // Then for LightningConfirm to send its response back and close
      await flushPromises();

      expect(LightningConfirm.open.mock.calls).toHaveLength(1);

      // We answered 'Yes' so result is 'true'
      expect (await LightningConfirm.open.mock.results[0].value).toBeTruthy();

      // And a component dispatched the event
      expect(promptSubmitHandler).toHaveBeenCalledTimes(1);
      
      
      // Let's do this again, to check if LightningConfirm calls are counted
      button.click();
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // Wait for fetch resolving and return its 'no data' response
      await flushPromises();

      // Then for LightningConfirm to send its response back and close
      await flushPromises();

      expect(LightningConfirm.open.mock.calls).toHaveLength(2);
      expect (await LightningConfirm.open.mock.results[1].value).toBeTruthy();

      

      // And a component dispatched the event again
      expect(promptSubmitHandler).toHaveBeenCalledTimes(2);
    });



    /**
     * Now one more check.
     * Component has a separate block that handles the case with only one match from fetch
     * It should NOT render second picklist 
     * because there is only match, so we send it to parent component immediately 
     */

    it( 'handles single match response',  async () => {
      // Nothing interesting here, we just cover the logic block with test
      let { component, template } = createComponent({componentName, lwcTemplate});
      
      const addressSelectedHandler = jest.fn();
      component.addEventListener('addressselected', addressSelectedHandler);

      // Here we will return mocked response with single match
      global.fetch = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockFetchData.oneResult),
        })
      );
      
      let button = template.querySelector('lightning-button[data-id="fetch-button"');

      let countryPicklist = template.querySelector('c-lwc-multiselect[data-id="country-select"]');
      countryPicklist.value = countryPicklist.options[0].value;
      countryPicklist.dispatchEvent(new CustomEvent('select', { detail: { value: countryPicklist.value } }));

      let input = template.querySelector('lightning-input');
      input.value = '65652';
      input.dispatchEvent(new InputEvent('change', { target: {value: input.value} }));
      
      button.click();

      // Wait for fetch resolving and return its response
      await flushPromises();
      
      // Then the component logic to parse the response 
      // and send a CustomEvent to parent component with the only value of the fetch response
      await flushPromises();

      let addressPicklist = template.querySelector('c-lwc-multiselect[data-id="address-select"]');

      expect(addressPicklist).toBeNull();
      expect(addressSelectedHandler).toHaveBeenCalledTimes(1);
      expect(addressSelectedHandler.mock.calls[0][0].detail.value.summaryline)
        .toBe(mockFetchData.oneResult[0].summaryline);
    });


    /**
     * Ok, we finished testing main flow
     * One last function to check is 'handleKeydown'
     * It initializes fetch if the key is 'Enter'
     */
    it( 'handles Enter key in postcode input',  async () => {
      let { component, template } = createComponent({componentName, lwcTemplate});
      
      const addressSelectedHandler = jest.fn();
      component.addEventListener('addressselected', addressSelectedHandler);

      global.fetch = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockFetchData.oneResult),
        })
      );
      
      let countryPicklist = template.querySelector('c-lwc-multiselect[data-id="country-select"]');
      countryPicklist.value = countryPicklist.options[0].value;
      countryPicklist.dispatchEvent(new CustomEvent('select', { detail: { value: countryPicklist.value } }));

      let input = template.querySelector('lightning-input');
      input.value = '65652';
      input.dispatchEvent(new InputEvent('change', { target: {value: input.value} }));
      
      // Here it is. 
      input.dispatchEvent(new KeyboardEvent('keydown', { key : 'Enter' }));

      // Wait for fetch resolving and return its response
      await flushPromises();
      
      // Then the component logic to parse the response 
      // and send a CustomEvent to parent component with the only value of the fetch response
      await flushPromises();

      expect(addressSelectedHandler).toHaveBeenCalledTimes(1);
    });


    /**
     * We can check if lightning-spinner is shown up while fetching for data
     */
    it( 'shows spinner while fetch is going',  async () => {
      let { template } = createComponent({componentName, lwcTemplate});
      global.fetch = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockFetchData.oneResult),
        })
      );
      // First let us check if there is no spinner
      let spinner = template.querySelector('lightning-spinner');
      expect(spinner).toBeNull();

      let countryPicklist = template.querySelector('c-lwc-multiselect[data-id="country-select"]');
      countryPicklist.value = countryPicklist.options[0].value;
      countryPicklist.dispatchEvent(new CustomEvent('select', { detail: { value: countryPicklist.value } }));

      let input = template.querySelector('lightning-input');
      input.value = '65652';
      input.dispatchEvent(new InputEvent('change', { target: {value: input.value} }));
      
      // We call component to fetch here
      input.dispatchEvent(new KeyboardEvent('keydown', { key : 'Enter' }));

      // Wait one cycle for spinner to show up
      await flushPromises();

      // Then - if spinner is here while fetching
      spinner = template.querySelector('lightning-spinner');
      expect(spinner).not.toBeNull();

      // Wait for fetch response 
      await flushPromises();
      // and component rerender
      await flushPromises();

      // And finally - if it is hidden again after fetch is done
      spinner = template.querySelector('lightning-spinner');
      expect(spinner).toBeNull();
    }); 
  }); 


  /**
   * To be able to see lightning toasts content we have to do some org setup first
   * 1. Create folder 'test' by the path 'force-app/main/default/'
   * 2. Create file 'platformShowToastEvent.js' inside 'test' folder
   * its content should be:
   *  export const ShowToastEventName = 'lightning__showtoast';
      export class ShowToastEvent extends CustomEvent {
        constructor(toast) {
          super(ShowToastEventName, {
            composed: true,
            cancelable: true,
            bubbles: true,
            detail: toast
          });
        }
      }
   *
   * 3. Create/update file 'jest.config.js' in the root org directory ( directory containing 'package.json' file)
   * it should look like this:
   *  const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

      module.exports = {
          ...jestConfig,
          modulePathIgnorePatterns: ['<rootDir>/.localdevserver'],
          moduleNameMapper: { // <<< This is what interests us right now
              '^lightning/platformShowToastEvent$':
                  '<rootDir>/force-app/main/default/test/jest-mocks/lightning/platformShowToastEvent'
          }
      };
   * 4. 
   */

  it('handles toast call', async () => {
    let { component, template } = createComponent({componentName, lwcTemplate});

    const showToastHandler = jest.fn();
    component.addEventListener(ShowToastEventName, showToastHandler);

    let button = template.querySelector('lightning-button[data-id="toast-button"');

    // We can also check if DOM element attributes are that we are expecting
    expect(button.label).toBe('Show toast');
    expect(button.variant).toBe('brand');
    expect(getClassString(button.classList)).toBe('button slds-var-m-left_small');

    button.click();

    // If you did all the steps to prepare jest setup above - you can see the toast content here.
    expect(showToastHandler.mock.calls[0][0].detail.title).toBe('Test toast');
    expect(showToastHandler.mock.calls[0][0].detail.message).toBe('Test toast message');
    expect(showToastHandler.mock.calls[0][0].detail.variant).toBe('success');

    // Otherwise you can only check if the toast was called
    expect(showToastHandler).toHaveBeenCalledTimes(1);
  });




  describe('Works with @wire methods', () => {
    /**
     * Now let's test getting data from Apex class through @wire adapter
     * For that there are: 
     * 1. Prepared mocked data,
     * 2. Imported function from real class 'TestsGuidelineController.getContactList'
     * 3. Prepared a function that will replace the real class callout while test is running. 
     *    It uses imported 'createApexTestWireAdapter'
     */
    
    

    it('gets the data from apex class using @wire params. Contacts are a wired variable. Accounts are a wired function', async () => {
      let { template } = createComponent({componentName, lwcTemplate});
      
      let contactEls = template.querySelectorAll('.contact');
      expect(contactEls.length).toBe(0);
      
      // Emit mocked data from mocked @wire
      getContactList.emit(mockGetContactList);
      getAccountList.emit(mockGetAccountList.list);

      
      // Wait for any asynchronous DOM updates
      await flushPromises();
      // Select elements for validation
      contactEls = template.querySelectorAll('.contact');
      expect(contactEls.length).toBe(mockGetContactList.length);
      expect(contactEls[0].textContent).toBe(mockGetContactList[0].Name);

      const accountEls = template.querySelectorAll('.account');
      expect(accountEls.length).toBe(mockGetAccountList.list.length);
      expect(accountEls[0].textContent).toBe(mockGetAccountList.list[0].Name);
    });


    /**
     * Let's get some data using @wire from lightning API functions
     * here @wire triggers right after its bound value is changed.
     */
    it('gets the data from lightning API using @wire params.', async () => {
      let { template } = createComponent({componentName, lwcTemplate});

      // By default if there is a bound value and it is empty
      // but the server expects it to be filled with value
      // the @wire callback returns an object that look like
      // { data: null, error: null }
      
      // Emit mock data from @wire. 
      // We are doing this instead of Salesforce as it doesn't do this in test-environment.
      getObjectInfo.emit({ data: null, error: null });


      let USER_INPUT = 'Account';
      let input = template.querySelector('[data-id="get-object-info-input"]');
      input.value = USER_INPUT;

      let button = template.querySelector('[data-id="get-object-info-button"]');
      button.click();
      
      // Emit mock data from @wire.
      // We are doing this instead of Salesforce as it doesn't do this in test-environment.
      getObjectInfo.emit(mockAccountRecord);

      await flushPromises();
      expect(getObjectInfo.getLastConfig()).toEqual({
        objectApiName: USER_INPUT
      });
      expect(template.querySelector('.scroller')).not.toBeNull();

      let record = JSON.parse(template.querySelector('.scroller').querySelector('pre').textContent);

      expect(record.apiName).toBe(mockAccountRecord.apiName);
    });


    
    /**
     * Let's imitate @wire call failing here.
     */

    it('shows error if @wire fails to fetch data', async () => {
      let { template } = createComponent({componentName, lwcTemplate});

      // Emit error from @wire
      getObjectInfo.error();

      await flushPromises();

      const errorPanelEl = template.querySelector('.wire-errors');
      expect(errorPanelEl).not.toBeNull();
    });
  });






  describe('Works with Salesforce LDS', () => { 

    /**
     * Now let's work with LDS CRUD. 
     * Create record. Success / Error
     */

    it('can create a record using createRecord LDS', async ()=> {
      let { template } = createComponent({componentName, lwcTemplate});

      const USER_INPUT = 'Test JEST Account';
      const CREATED_RECORD = [
        { apiName: 'Account', fields: { Name: USER_INPUT } }
      ];

      const input = template.querySelector('[data-id="create-record-input"]');
      input.value = USER_INPUT;
      input.dispatchEvent(new InputEvent('change'));

      
      // Assign mock value for resolved createRecord promise
      createRecord.mockResolvedValue(mockLDSCreateRecord);

      // Triggering the createRecord LDS
      const button = template.querySelector('[data-id="create-record-button"]');
      button.click();
      
      await flushPromises();

      // Validate createRecord call
      expect(createRecord).toHaveBeenCalled();
      expect(createRecord.mock.calls[0]).toEqual(CREATED_RECORD);

      // Validate UI to update with the results of createRecord
      const displayEl = template.querySelector( '[data-id="accountId"]' );
      expect(displayEl.value).toBe(mockLDSCreateRecord.id);

    })

    it('displays an error toast on createRecord error', async () => {
      let { component, template } = createComponent({componentName, lwcTemplate});
      const USER_INPUT = 'invalid';

      const showToastHandler = jest.fn();
      component.addEventListener(ShowToastEventName, showToastHandler);

      const input = template.querySelector('[data-id="create-record-input"]');
      input.value = USER_INPUT;
      input.dispatchEvent(new InputEvent('change'));

      // Assign mock value for rejected createRecord promise
      createRecord.mockRejectedValue(new Error('Account creation error'));

      // Triggering the createRecord LDS
      const button = template.querySelector('[data-id="create-record-button"]');
      button.click();
      
      await flushPromises();

      // Check if toast event has been fired
      expect(showToastHandler).toHaveBeenCalled();
      expect(showToastHandler.mock.calls[0][0].detail.variant).toBe('error');
    });


    /**
     * Now let's delete some records using LDS
     */

    
    it('renders seven records with name and lightning-button-icon', async () => {
      let { template } = createComponent({componentName, lwcTemplate});

      // Emit data from @wire
      getAccountList.emit(mockLDSDeleteRecord.accounts);

      // Wait for any asynchronous DOM updates
      await flushPromises();

      // Select elements for validation
      const nameEl = template.querySelector( '[data-id="delete-record-lds-layout-items"]' );
      expect(nameEl.textContent).toBe(mockLDSDeleteRecord.accounts[0].Name);

      const buttons = template.querySelectorAll('[data-id="delete-record-lds-delete-button"]');
      expect(buttons.length).toBe(mockLDSDeleteRecord.accounts.length);
      expect(buttons[0].dataset.recordid).toBe(mockLDSDeleteRecord.accounts[0].Id);
  });

    it('renders no buttons when no record exists', async () => {
      let { template } = createComponent({componentName, lwcTemplate});

      // Emit empty data from @wire
      getAccountList.emit(mockLDSDeleteRecord.noAccounts);

      // Wait for any asynchronous DOM updates
      await flushPromises();

      // Select elements for validation
      const singleButton = template.querySelector('[data-id="delete-record-lds-delete-button"]');
      expect(singleButton).toBeNull();
      
      const detailEls = template.querySelectorAll('[data-id="delete-record-lds-delete-button"]');
      expect(detailEls.length).toBe(mockLDSDeleteRecord.noAccounts.length);
    });

    it('deletes the first entry of the account list on button click', async () => {
      let { template } = createComponent({componentName, lwcTemplate});

      // Emit data from @wire
      getAccountList.emit(mockLDSDeleteRecord.accounts);

      // Wait for any asynchronous DOM updates
      await flushPromises();

      // Select button for simulating user interaction
      const singleButton = template.querySelector('[data-id="delete-record-lds-delete-button"]');
      singleButton.click();

      // Wait for any asynchronous DOM updates
      await flushPromises();

      // Validate if deleteRecord has been called
      expect(deleteRecord).toHaveBeenCalled();
      expect(deleteRecord.mock.calls[0][0]).toEqual(mockLDSDeleteRecord.accounts[0].Id);

      // the real LDS will now update the component info 
      // As we asked for refreshApex and there is a wiredAccountsResult 
      // So emit updated data from @wire
      getAccountList.emit(mockLDSDeleteRecord.modifiedAccounts);

      // Wait for any asynchronous DOM updates
      await flushPromises();

      const buttons = template.querySelectorAll('[data-id="delete-record-lds-delete-button"]');
      expect(buttons.length).toEqual(mockLDSDeleteRecord.modifiedAccounts.length);
    });

    it('shows the error if deleteRecord failed', async () => {
      let { template } = createComponent({componentName, lwcTemplate});

      // Emit data from @wire
      getAccountList.emit(mockLDSDeleteRecord.accounts);

      // Wait for any asynchronous DOM updates
      await flushPromises();

      // Select button for simulating user interaction
      const singleButton = template.querySelector('[data-id="delete-record-lds-delete-button"]');
      singleButton.click();

      // Emit error from @wire
      getAccountList.error('Some error happened');

      // Wait for any asynchronous DOM updates and test acccessibility
      await flushPromises();
      
      const deleteRecordErrorUI = template.querySelector('.delete-record-error');
      await expect(deleteRecordErrorUI).not.toBeNull();

      
      const buttons = template.querySelectorAll('[data-id="delete-record-lds-delete-button"]');
      expect(buttons.length).toEqual(mockLDSDeleteRecord.accounts.length);
    });


    /**
     * Now what about updating record through LDS?
     */

    it('updates a record through LDS', async() => {
      let { template } = createComponent({componentName, lwcTemplate});
 
      // Emit getting accounts.
      getAccountList.emit(mockGetAccountList.list);
    
      // Waiting for callout response;
      await flushPromises();
      
      // Emit getting the account to update through @wire
      getRecord.emit(mockGetSingleAccount);

      //DOM update
      await flushPromises();

      // Checking if DOM shows the account name
      let updateAccountInput = template.querySelector('[data-id="update-record-lds-input"]');
      expect(updateAccountInput).not.toBeNull();
      expect(updateAccountInput.value).toBe(mockGetSingleAccount.Name);


      //Updating value and sending it back
      updateAccountInput.value = updateAccountInput.value + ' test';

      let updateAccountButton = template.querySelector('[data-id="update-record-lds-update-button"]');
      updateAccountButton.click();

      // request to update should be there
      await flushPromises();

      expect(updateRecord).toHaveBeenCalled();
      expect(updateRecord.mock.calls[0][0].fields.Id).toEqual(mockGetSingleAccount.Id);
    })


  });






  describe('Works with Salesforce server callouts', () => { 
    
    /**
     * Let's test some explicit server calls.
     * There is nothing really special for now
     */

    it('handles server callouts and updates the DOM', async()=> {
      let { template } = createComponent({componentName, lwcTemplate});

      // Preparing the response from server BEFORE actual callout happens
      imperativeGetAccountList.mockResolvedValue(mockGetAccountList.list);

      // calling server for the data
      let button = template.querySelector('[data-id="get-accounts-button"]');
      button.click();

      // waiting for server response and dom updates
      await flushPromises();

      let items = template.querySelectorAll('[data-id="get-accounts-item"]');
      expect(items.length).toEqual(mockGetAccountList.list.length);
      expect(items[0].textContent).toEqual(mockGetAccountList.list[0].Name);

    })
    /**
     * Let's test some explicit server calls.
     * There is nothing really special for now
     */

    it('reacts on empty response of server callout', async()=> {
      let { component, template } = createComponent({componentName, lwcTemplate});

      // We know the component should show the toast with error
      const showToastHandler = jest.fn();
      component.addEventListener(ShowToastEventName, showToastHandler);

      imperativeGetAccountList.mockResolvedValue(mockGetAccountList.emptyList);
      let button = template.querySelector('[data-id="get-accounts-button"]');
      button.click();

      // waiting for server response
      await flushPromises();

      expect(showToastHandler.mock.calls[0][0].detail.title).toBe('Error');
      expect(showToastHandler.mock.calls[0][0].detail.message).toBe('No accounts found');
      expect(showToastHandler.mock.calls[0][0].detail.variant).toBe('error');

      expect(showToastHandler).toHaveBeenCalledTimes(1);
      

      let items = template.querySelectorAll('[data-id="get-accounts-item"]');
      expect(items.length).toBe(0);

    })


    it('handles server callout error and updates the DOM', async()=> {
      let { template } = createComponent({componentName, lwcTemplate});

      // Preparing the response from server BEFORE actual callout happens
      imperativeGetAccountList.mockRejectedValue('Some Error happened')

      // calling server for the data
      let button = template.querySelector('[data-id="get-accounts-button"]');
      button.click();

      // waiting for server rejection and dom updates
      await flushPromises();

      let errorBlock = template.querySelector('[data-id="get-accounts-error"]');
      expect(errorBlock).not.toBeNull();
      expect(errorBlock.textContent).toEqual('Some Error happened');

    })
  });

  /**
   * Links to know more
   * // https://github.com/trailheadapps/lwc-recipes
   * // https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.testing
   * // https://lwc.dev/guide/test
   * // https://www.mstsolutions.com/technical/lwc-testing-with-jest-framework/
   * 
   * 
   * 
   * Checks for template elements attributes
      const imgEl = template.querySelector('img');
      expect(imgEl.src).toBe('...');
   *
   */
});