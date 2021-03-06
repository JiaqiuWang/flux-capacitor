import { reduxBatch } from '@manaflair/redux-batch';
import * as redux from 'redux';
import reduxLogger from 'redux-logger';
import { ActionCreators as ReduxActionCreators } from 'redux-undo';
import * as sinon from 'sinon';
import Actions from '../../../../src/core/actions';
import ActionCreators from '../../../../src/core/actions/creators';
import ConfigurationAdapter from '../../../../src/core/adapters/configuration';
import PersonalizationAdapter from '../../../../src/core/adapters/personalization';
import Events from '../../../../src/core/events';
import Selectors from '../../../../src/core/selectors';
import Middleware, {
  PERSONALIZATION_CHANGE_ACTIONS,
  PAST_PURCHASE_SKU_ACTIONS,
  RECALL_CHANGE_ACTIONS,
  SEARCH_CHANGE_ACTIONS,
  PAST_PURCHASES_SEARCH_CHANGE_ACTIONS,
} from '../../../../src/core/store/middleware';
import suite from '../../_suite';

suite('Middleware', ({ expect, spy, stub }) => {
  let next: sinon.SinonSpy;

  beforeEach(() => next = spy());

  describe('create()', () => {
    const sagaMiddleware = { a: 'b' };
    const idGeneratorMiddleware = { g: 'h' };
    const errorHandlerMiddleware = { i: 'j' };
    const checkPastPurchaseSkusMiddleware = { m: 'n' };
    const validatorMiddleware = { m: 'n' };
    const allMiddleware = () => [
      Middleware.thunkEvaluator,
      Middleware.injectStateIntoRehydrate,
      Middleware.validator,
      idGeneratorMiddleware,
      idGeneratorMiddleware,
      errorHandlerMiddleware,
      checkPastPurchaseSkusMiddleware,
      sagaMiddleware,
      Middleware.personalizationAnalyzer,
      Middleware.thunkEvaluator,
      Middleware.saveStateAnalyzer
    ];

    afterEach(() => delete process.env.NODE_ENV);

    it('should return composed middleware', () => {
      const flux: any = { __config: {} };
      const composed = ['e', 'f'];
      const simpleMiddleware = ['k', 'l'];
      const batchMiddleware = ['k', 'l'];
      const thunkMiddleware = ['k', 'l'];
      const idGenerator = stub(Middleware, 'idGenerator').returns(idGeneratorMiddleware);
      const errorHandler = stub(Middleware, 'errorHandler').returns(errorHandlerMiddleware);
      const checkPastPurchaseSkus = stub(Middleware, 'checkPastPurchaseSkus').returns(checkPastPurchaseSkusMiddleware);
      const compose = stub(redux, 'compose').returns(composed);
      const applyMiddleware = stub(redux, 'applyMiddleware');
      applyMiddleware.withArgs().returns(batchMiddleware);
      applyMiddleware.withArgs(Middleware.thunkEvaluator, Middleware.validator).returns(thunkMiddleware);
      applyMiddleware.withArgs(Middleware.thunkEvaluator, Middleware.saveStateAnalyzer).returns(simpleMiddleware);

      const middleware = Middleware.create(sagaMiddleware, flux);

      expect(idGenerator).to.have.callCount(2)
        .and.calledWithExactly('recallId', RECALL_CHANGE_ACTIONS)
        .and.calledWithExactly('searchId', SEARCH_CHANGE_ACTIONS);
      expect(errorHandler).to.be.calledWithExactly(flux);
      expect(applyMiddleware).to.be.calledWithExactly(...allMiddleware());
      expect(compose).to.be.calledWithExactly(
        simpleMiddleware,
        reduxBatch,
        batchMiddleware,
        reduxBatch,
        thunkMiddleware,
        reduxBatch,
      );
      expect(middleware).to.eql(composed);
    });

    it('should include redux-logger when running in development and debug set', () => {
      const flux: any = { __config: { services: { logging: { debug: { flux: true } } } } };
      const applyMiddleware = stub(redux, 'applyMiddleware');
      stub(Middleware, 'idGenerator').returns(idGeneratorMiddleware);
      stub(Middleware, 'errorHandler').returns(errorHandlerMiddleware);
      stub(Middleware, 'validator').returns(Middleware.validator);
      stub(Middleware, 'checkPastPurchaseSkus').returns(checkPastPurchaseSkusMiddleware);
      stub(redux, 'compose');
      process.env.NODE_ENV = 'development';

      Middleware.create(sagaMiddleware, flux);

      expect(applyMiddleware).to.be.calledWithExactly(...allMiddleware(), reduxLogger);
    });

    it('should not include redux-logger when running in development and debug not set', () => {
      const flux: any = { __config: {} };
      const applyMiddleware = stub(redux, 'applyMiddleware');
      stub(Middleware, 'idGenerator').returns(idGeneratorMiddleware);
      stub(Middleware, 'errorHandler').returns(errorHandlerMiddleware);
      stub(Middleware, 'validator').returns(Middleware.validator);
      stub(Middleware, 'checkPastPurchaseSkus').returns(checkPastPurchaseSkusMiddleware);
      stub(redux, 'compose');
      process.env.NODE_ENV = 'development';

      Middleware.create(sagaMiddleware, flux);

      expect(applyMiddleware).to.be.calledWithExactly(...allMiddleware());
    });
  });

  describe('idGenerator()', () => {
    it('should add id if action type is in whitelist', () => {
      const idKey = 'myId';
      const whitelist = ['a', 'b', 'c'];

      Middleware.idGenerator(idKey, whitelist)(null)(next)({ type: 'b', c: 'd' });

      expect(next).to.be.calledWith({ type: 'b', c: 'd', meta: { [idKey]: sinon.match.string } });
    });

    it('should augment existing meta', () => {
      const idKey = 'myId';
      const meta = { d: 'e' };

      Middleware.idGenerator(idKey, ['a', 'b', 'c'])(null)(next)({ type: 'b', c: 'd', meta });

      expect(next).to.be.calledWithExactly({ type: 'b', c: 'd', meta: { d: 'e', [idKey]: sinon.match.string } });
    });

    it('should not modify action if type not in whitelist', () => {
      const idKey = 'myId';
      const originalAction = { a: 'b', type: 'c' };

      Middleware.idGenerator(idKey, ['e', 'f', 'g'])(null)(next)(originalAction);

      expect(next).to.be.calledWith(originalAction);
    });
  });

  describe('errorHandler()', () => {
    it('should emit ERROR_FETCH_ACTION on error', () => {
      const payload = { a: 'b' };
      const emit = spy();

      const error = Middleware.errorHandler(<any>{ emit })(null)(() => null)(<any>{ error: true, payload });

      expect(emit).to.be.calledWith(Events.ERROR_FETCH_ACTION, payload);
      expect(error).to.eq(payload);
    });

    it('should allow valid actions through', () => {
      const action: any = { a: 'b' };

      Middleware.errorHandler(<any>{})(null)(next)(action);

      expect(next).to.be.calledWith(action);
    });

    it('should handle failed RECEIVE_PRODUCTS action', () => {
      const action = { type: Actions.RECEIVE_PRODUCTS, error: true };
      const undoAction = { a: 'b' };
      const next = spy();
      stub(ReduxActionCreators, 'undo').returns(undoAction);

      Middleware.errorHandler(<any>{})(null)(next)(action);

      expect(next).to.be.calledWith(undoAction);
    });
  });

  describe('checkPastPurchaseSkus()', () => {
    it('should pass action through if not in PAST_PURCHASE_SKU_ACTIONS', () => {
      const action = { type: 'NOT_ACTUALLY_AN_ACTION' };

      Middleware.checkPastPurchaseSkus(<any>{})(null)(next)(action);

      expect(next).to.be.calledWith(action);
    });

    it('should pass action through if past purchases present', () => {
      const action = { type: PAST_PURCHASE_SKU_ACTIONS[0] };
      const state = { a: 'b' };
      const getState = stub().returns(state);
      const pastPurchases = stub(Selectors, 'pastPurchases').returns([1]);

      Middleware.checkPastPurchaseSkus(<any>{ store: { getState }})(null)(next)(action);

      expect(next).to.be.calledWithExactly(action);
      expect(getState).to.be.calledOnce;
      expect(pastPurchases).to.be.calledWithExactly(state);
    });

    it('should call flux.on if past purchases not present', () => {
      const action = { type: PAST_PURCHASE_SKU_ACTIONS[0] };
      const state = { a: 'b' };
      const conf = { c: 'd' };
      const payload = { e: 'f' };
      const getState = stub().returns(state);
      const once = spy();
      const dispatch = spy();
      const pastPurchases = stub(Selectors, 'pastPurchases').returns([]);
      const config = stub(Selectors, 'config').returns(conf);
      const extract = stub(ConfigurationAdapter, 'extractSecuredPayload').returns(payload);

      Middleware.checkPastPurchaseSkus(<any>{ store: { getState }, once })(
          <any>{ dispatch })(next)(action);
      once.getCall(0).args[1]();

      expect(getState).to.be.calledTwice;
      expect(pastPurchases).to.be.calledWithExactly(state);
      expect(once).to.be.calledWith(Events.PAST_PURCHASE_SKUS_UPDATED);
      expect(dispatch).to.be.calledWithExactly(action);
      expect(config).to.be.calledWithExactly(state);
      expect(extract).to.be.calledWithExactly(conf);
    });

    it('should do nothing if past purchases not present and no secured payload', () => {
      const action = { type: PAST_PURCHASE_SKU_ACTIONS[0] };
      const state = { a: 'b' };
      const conf = { c: 'd' };
      const payload = null;
      const getState = stub().returns(state);
      const once = spy();
      const pastPurchases = stub(Selectors, 'pastPurchases').returns([]);
      const config = stub(Selectors, 'config').returns(conf);
      const extract = stub(ConfigurationAdapter, 'extractSecuredPayload').returns(payload);

      Middleware.checkPastPurchaseSkus(<any>{ store: { getState }, once })(
          <any>{ })(next)(action);

      expect(getState).to.be.calledTwice;
      expect(once).to.not.be.called;
      expect(config).to.be.calledWithExactly(state);
      expect(extract).to.be.calledWithExactly(conf);
    });
  });

  describe('pastPurchaseProductAnalyzer()', () => {
    it('should call insertAction', () => {
      const ret = 'middleware';
      const insert = stub(Middleware, 'insertAction').returns(ret);

      expect(Middleware.pastPurchaseProductAnalyzer()).to.eql(ret);

      expect(insert).to.be.calledWithExactly(PAST_PURCHASES_SEARCH_CHANGE_ACTIONS,
                                             ActionCreators.fetchPastPurchaseProducts());
    });
  });

  describe('saveStateAnalyzer()', () => {
    it('should pass through other actions', () => {
      const next = spy();
      const action = {
        type: 'NOT_AN_ACTION',
        payload: {}
      };

      Middleware.injectStateIntoRehydrate(<any>{ getState: () => null })(next)(action);

      expect(next).to.be.calledWithExactly(action);
    });

    it('should pass through rehydrates without payload', () => {
      const next = spy();
      const getState = spy();
      const action = {
        type: 'persist/REHYDRATE',
      };

      Middleware.injectStateIntoRehydrate(<any>{ getState })(next)(action);

      expect(next).to.be.calledWithExactly(action);
    });

    it('should pass through rehydrates without biasing', () => {
      const next = spy();
      const getState = spy();
      const action = {
        type: 'persist/REHYDRATE',
        payload: {}
      };

      Middleware.injectStateIntoRehydrate(<any>{ getState })(next)(action);

      expect(next).to.be.calledWithExactly(action);
    });

    it('should call transformFromBrowser if biasing present', () => {
      const next = spy();
      const state = 's';
      const getState = stub().returns(state);
      const biasing = 'bias';
      const converted = 'conf';
      const action = {
        type: 'persist/REHYDRATE',
        payload: {
          biasing,
          a: 3,
          b: 6,
        }
      };
      const transform = stub(PersonalizationAdapter, 'transformFromBrowser').returns(converted);

      Middleware.injectStateIntoRehydrate(<any>{ getState })(next)(action);

      expect(next).to.be.calledWithExactly({
        ...action,
        payload: {
          ...action.payload,
          biasing: converted
        }
      });
      expect(transform).to.be.calledWithExactly(biasing, state);
    });
  });

  describe('saveStateAnalyzer()', () => {
    it('should add SAVE_STATE action if match found', () => {
      const batchAction = [{ type: 'a' }, { type: Actions.RECEIVE_PRODUCTS }];

      Middleware.saveStateAnalyzer()(next)(batchAction);

      expect(next).to.be.calledWithExactly([...batchAction, { type: Actions.SAVE_STATE }]);
    });

    it('should not add SAVE_STATE action if no match found', () => {
      const batchAction = [{ type: 'a' }, { type: 'b' }];

      Middleware.saveStateAnalyzer()(next)(batchAction);

      expect(next).to.be.calledWithExactly(batchAction);
    });
  });

  describe('thunkEvaluator()', () => {
    it('should pass forward a plain object action', () => {
      const action = { a: 'b' };

      Middleware.thunkEvaluator(null)(next)(action);

      expect(next).to.be.calledWithExactly(action);
    });

    it('should evaluate and pass forward a synchonous thunk action', () => {
      const action = { a: 'b' };
      const state = { c: 'd' };
      const thunk = spy(() => action);
      const getState = () => state;

      Middleware.thunkEvaluator(<any>{ getState })(next)(thunk);

      expect(next).to.be.calledWithExactly(action);
      expect(thunk).to.be.calledWithExactly(state);
    });
  });

  describe('personalizationAnalyzer()', () => {
    const conf = { a: 1 };
    const state = { b: 2 };

    it('should pass the action forward unchanged if not in list of relevant actions', () => {
      const action = { a: 'b', type: 'NOT_VALID_ACTION' };
      const config = stub(Selectors, 'config').returns(conf);
      const enabled = stub(ConfigurationAdapter, 'isRealTimeBiasEnabled').returns(true);
      const next = spy();
      const getState = spy(() => state);

      Middleware.personalizationAnalyzer(<any>{ getState })(next)(action);

      expect(next).to.be.calledWithExactly(action);
      expect(config).to.be.calledWithExactly(state);
      expect(enabled).to.be.calledWithExactly(conf);
      expect(getState).to.be.called;
    });

    it('should pass the action forward unchanged if real time biasing disabled', () => {
      const action = { a: 'b', type: PERSONALIZATION_CHANGE_ACTIONS[0] };
      const config = stub(Selectors, 'config').returns(conf);
      const enabled = stub(ConfigurationAdapter, 'isRealTimeBiasEnabled').returns(false);
      const next = spy();
      const getState = spy(() => state);

      Middleware.personalizationAnalyzer(<any>{ getState })(next)(action);

      expect(next).to.be.calledWithExactly(action);
    });

    it('should pass the action forward if extractBias returns falsy', () => {
      const action = { a: 'b', type: PERSONALIZATION_CHANGE_ACTIONS[0] };
      const returnAction = 'return';
      const extracted = 'extra';
      const config = stub(Selectors, 'config').returns(conf);
      const updateBiasing = stub(ActionCreators, 'updateBiasing').returns(returnAction);
      const extract = stub(PersonalizationAdapter, 'extractBias').returns(null);
      const next = spy();
      const getState = spy(() => state);
      stub(ConfigurationAdapter, 'isRealTimeBiasEnabled').returns(true);

      Middleware.personalizationAnalyzer(<any>{ getState })(next)(action);

      expect(next).to.be.calledWithExactly(action);
      expect(extract).to.be.calledWithExactly(action, state);
      expect(updateBiasing).to.not.be.called;
    });

    it('should make a batch action if action correct type', () => {
      const action = { a: 'b', type: PERSONALIZATION_CHANGE_ACTIONS[0] };
      const returnAction = 'return';
      const extracted = 'extra';
      const config = stub(Selectors, 'config').returns(conf);
      const updateBiasing = stub(ActionCreators, 'updateBiasing').returns(returnAction);
      const extract = stub(PersonalizationAdapter, 'extractBias').returns(extracted);
      const next = spy();
      const getState = spy(() => state);
      stub(ConfigurationAdapter, 'isRealTimeBiasEnabled').returns(true);

      Middleware.personalizationAnalyzer(<any>{ getState })(next)(action);

      expect(next).to.be.calledWith([action, returnAction]);
      expect(extract).to.be.calledWithExactly(action, state);
      expect(updateBiasing).to.be.calledWithExactly(extracted);
    });
  });
});
