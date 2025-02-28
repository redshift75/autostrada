'use server';

// This file is used to mark modules as server-only
// Import this file in any module that uses Node.js-specific APIs
// This ensures that the module is never imported on the client side

// Check if we're on the server
const isServer = typeof window === 'undefined';

// This error will be thrown if the module is imported on the client side
if (!isServer) {
  throw new Error('This module can only be used on the server side');
}

// Export an async function instead of a boolean
export async function checkIsServer() {
  return isServer;
} 