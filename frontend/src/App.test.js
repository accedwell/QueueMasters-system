import { render, screen } from '@testing-library/react';
import App from './App';
import api from './api';

jest.mock('./api', () => ({
  __esModule: true,
  default: { get: jest.fn(() => Promise.resolve({ data: [] })), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  errorMessage: () => 'error',
  API_URL: 'http://localhost:8080/api',
}));

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = jest.fn();
  api.get.mockImplementation((path) => path === '/auth/me'
    ? Promise.reject({ response: { status: 401 } })
    : Promise.resolve({ data: [] }));
});

test('renders the landing page hero and services', async () => {
  render(<App />);
  expect(screen.getByText(/Showroom shine/i)).toBeInTheDocument();
  expect(await screen.findByText(/Pick your level of clean/i)).toBeInTheDocument();
  expect(screen.getAllByText(/Full Valet/i).length).toBeGreaterThan(0);
});
