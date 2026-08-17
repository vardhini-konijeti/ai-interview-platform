import axios from 'axios';

// Points to your Express backend
export const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});