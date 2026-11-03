// Entry of the game page (index.html): loads the data, hands it to the store and draws the app.
import { h, render } from 'preact';
import { App } from '../ui/App';
import { loadGameData } from './data';
import { store } from './store';

const root = document.getElementById('app');
if (root) {
  render(h(App, {}), root);
  void loadGameData().then((d) => store.setData(d));
  // the store in the console of a development page (a check by hand or by a browser tool drives the clock through it); not in the build
  if (import.meta.env.DEV) (window as unknown as { __overseer?: typeof store }).__overseer = store;
}
