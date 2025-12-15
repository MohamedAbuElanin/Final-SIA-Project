/**
 * Route Validator - Diagnostic Tool
 * 
 * This script validates that all routes are properly registered
 * and can be accessed. Run this after server startup to verify
 * route registration.
 */

const express = require('express');

/**
 * Extract all registered routes from Express app
 */
function extractRoutes(app) {
    const routes = [];
    
    function extractFromStack(stack, basePath = '') {
        if (!stack) return;
        
        stack.forEach((layer) => {
            if (layer.route) {
                // Direct route
                const methods = Object.keys(layer.route.methods)
                    .filter(method => layer.route.methods[method])
                    .map(m => m.toUpperCase());
                
                if (methods.length > 0) {
                    routes.push({
                        methods,
                        path: basePath + layer.route.path,
                        regex: layer.regexp.toString()
                    });
                }
            } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
                // Router middleware - recurse
                const routerPath = basePath + (layer.regexp.source
                    .replace('\\/?', '')
                    .replace('(?=\\/|$)', '')
                    .replace(/\\\//g, '/')
                    .replace(/\^/g, '')
                    .replace(/\$/g, '') || '');
                
                extractFromStack(layer.handle.stack, routerPath);
            }
        });
    }
    
    if (app._router && app._router.stack) {
        extractFromStack(app._router.stack);
    }
    
    return routes;
}

/**
 * Validate route exists
 */
function validateRoute(app, method, path) {
    const routes = extractRoutes(app);
    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    
    const matchingRoute = routes.find(route => {
        const routePath = route.path.endsWith('/') ? route.path.slice(0, -1) : route.path;
        return route.methods.includes(method.toUpperCase()) && 
               (routePath === normalizedPath || routePath === normalizedPath + '/');
    });
    
    return {
        exists: !!matchingRoute,
        route: matchingRoute,
        allRoutes: routes
    };
}

module.exports = { extractRoutes, validateRoute };

