import { createBrowserRouter } from 'react-router';
import { HomePage } from './pages/home-page';
import { ResultsPage } from './pages/results-page';
import { CarparkDetailPage } from './pages/carpark-detail-page';

export const router = createBrowserRouter([
    {
        path: '/',
        Component: HomePage,
    },
    {
        path: '/results',
        Component: ResultsPage,
    },
    {
        path: '/carpark/:id',
        Component: CarparkDetailPage,
    },
]);
