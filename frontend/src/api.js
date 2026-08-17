import axios from 'axios';

// Points to your Express backend
export const API = axios.create({
  baseURL: 'https://ai-interview-platform-2yc4.onrender.com/api'
});