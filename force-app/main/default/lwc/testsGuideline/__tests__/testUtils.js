import { createElement } from 'lwc';

export const clearBodyAfterTest = () => {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }

  // Prevent data saved on mocks from leaking between tests
  jest.clearAllMocks();
}


export const createComponent = (config) => {
  const component = createElement(config.componentName, {
    is: config.lwcTemplate
  });
  Object.assign(component, config);
  document.body.appendChild(component);
  
  return { component, template: component.shadowRoot};
}

export async function flushPromises() {
  return Promise.resolve();
}


// Not really needed but it is good to know we can setTimeouts inside tests
// standard setTimeout is just ignored by test, as it is called after test is done
export const sleep = async (ms) => {
  await new Promise(resolve => {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

export const getClassString = (el) => {
  if (typeof el.classList === 'string') return el.classList;
  
  let classList = [];
  for ( let i in el) { 
    if (Object.prototype.hasOwnProperty.call(el, i)) {
      classList[i] = el[i] 
    }
  }
  return classList.join(' ');
}
