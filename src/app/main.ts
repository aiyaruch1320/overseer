// Entry of the game page (index.html): loads the data, hands it to the store and draws the app.
import { h, render } from 'preact';
import { App } from '../ui/App';
import { loadGameData } from './data';
import { store } from './store';

const root = document.getElementById('app');
if (root) {
  render(h(App, {}), root);
  void loadGameData().then((d) => store.setData(d));
}
