import Actions from '../actions';
import Configuration from '../configuration';
import Selectors from '../selectors';
import Store from '../store';

namespace Personalization {
  export const extractBias = ({ payload }: Actions.SelectRefinement, store: Store.State) => {
    // TODO: check if we need to bias for it, we're not using config at all
    const config = Selectors.config(store).personalization.realtimeBiasing;
    const byId = Selectors.realTimeBiasesById(store);

    const { value, field } = Selectors.refinementCrumb(store, payload.navigationId, payload.index);
    return {
      variant: field,
      key: value,
      config: Selectors.config(store),
      bias: (byId[field] && byId[field][value]) ? {
        ...byId[field][value],
        lastUsed: Date.now()
      } : generateNewBias(value, field)
    };
  };

  export const generateNewBias = (value, field) => {
    return {
      lastUsed: Date.now()
    };
  };

  export const transformToBrowser = (state, reducerKey) => {
    state.allIds.map(({ variant, key }) => ({
      variant,
      key,
      ...state.byId[variant][key]
    }));

    console.log('state from toBrowser', state);

  }

  export const transformFromBrowser = (state: any[], reducerKey) => {
    console.log('statefrom fromBrowser', state);
    const olderThanTime = Date.now() - 2592000;
    const filteredState = state.filter((element) => element.lastUsed >= olderThanTime);
    let allIds = [];
    let byId = {};
    filteredState.forEach(({ variant, key, lastUsed }) => {
      allIds.push({ variant, key });
      if (!byId[variant]) {
        byId[variant] = {};
      }
      byId[variant][key] = { lastUsed };
    });

    return {
      allIds,
      byId
    };
  };
}

export default Personalization;
