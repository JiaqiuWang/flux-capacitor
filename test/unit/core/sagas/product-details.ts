import * as effects from 'redux-saga/effects';
import * as sinon from 'sinon';
import Actions from '../../../../src/core/actions';
import * as Events from '../../../../src/core/events';
import sagaCreator, { Tasks } from '../../../../src/core/sagas/product-details';
import Selectors from '../../../../src/core/selectors';
import suite from '../../_suite';

suite('product details saga', ({ expect, spy, stub }) => {

  describe('createSaga()', () => {
    it('should return a saga', () => {
      const flux: any = { a: 'b' };

      const saga = sagaCreator(flux)();

      // tslint:disable-next-line max-line-length
      expect(saga.next().value).to.eql(effects.takeLatest(Actions.FETCH_PRODUCT_DETAILS, Tasks.fetchProductDetails, flux));
      saga.next();
    });
  });

  describe('Tasks', () => {
    describe('fetchProductDetails()', () => {
      it('should return product details', () => {
        const id = '123';
        const config: any = { a: 'b' };
        const search = () => null;
        const emit = spy();
        const saveState = spy();
        const bridge = { search };
        const receiveDetailsProductAction: any = { c: 'd' };
        const receiveDetailsProduct = spy(() => receiveDetailsProductAction);
        const record = { allMeta: { e: 'f' } };
        const request = { g: 'h' };
        const flux: any = { emit, saveState, clients: { bridge }, actions: { receiveDetailsProduct }, config };

        const task = Tasks.fetchProductDetails(flux, <any>{ payload: id });

        expect(task.next().value).to.eql(effects.select(Selectors.searchRequest, config));
        expect(task.next(request).value).to.eql(effects.call([bridge, search], {
          g: 'h',
          query: null,
          pageSize: 1,
          skip: 0,
          refinements: [{ navigationName: 'id', type: 'Value', value: id }]
        }));
        expect(task.next({ records: [record] }).value).to.eql(effects.put(receiveDetailsProductAction));
        expect(emit).to.be.calledWith(Events.BEACON_VIEW_PRODUCT, record);

        task.next();
        expect(saveState).to.be.called;
      });

      it('should handle product not found', () => {
        const error = new Error();
        const receiveDetailsProductAction: any = { a: 'b' };
        const receiveDetailsProduct = spy(() => receiveDetailsProductAction);
        const flux: any = {
          clients: { bridge: { search: () => null } },
          actions: { receiveDetailsProduct }
        };

        const task = Tasks.fetchProductDetails(flux, <any>{});

        task.next();
        task.next();
        expect(task.next({ records: [] }).value).to.eql(effects.put(receiveDetailsProductAction));
        expect(receiveDetailsProduct).to.be.calledWith(sinon.match.instanceOf(Error));
        task.next();
      });

      it('should handle request failure', () => {
        const error = new Error();
        const receiveDetailsProductAction: any = { a: 'b' };
        const receiveDetailsProduct = spy(() => receiveDetailsProductAction);
        const flux: any = {
          clients: { bridge: { search: () => null } },
          actions: { receiveDetailsProduct }
        };

        const task = Tasks.fetchProductDetails(flux, <any>{});

        task.next();
        expect(task.throw(error).value).to.eql(effects.put(receiveDetailsProductAction));
        expect(receiveDetailsProduct).to.be.calledWith(error);
        task.next();
      });
    });
  });
});