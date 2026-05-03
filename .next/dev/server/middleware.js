"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "proxy";
exports.ids = ["proxy"];
exports.modules = {

/***/ "(middleware)/./node_modules/next/dist/build/webpack/loaders/next-middleware-loader.js?absolutePagePath=%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome%2Fplus%2Fsrc%2Fproxy.ts&page=%2Fproxy&rootDir=%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome%2Fplus&matchers=&preferredRegion=&middlewareConfig=e30%3D!":
/*!************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-middleware-loader.js?absolutePagePath=%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome%2Fplus%2Fsrc%2Fproxy.ts&page=%2Fproxy&rootDir=%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome%2Fplus&matchers=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   handler: () => (/* binding */ handler)\n/* harmony export */ });\n/* harmony import */ var next_dist_build_adapter_setup_node_env_external__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/build/adapter/setup-node-env.external */ \"next/dist/build/adapter/setup-node-env.external\");\n/* harmony import */ var next_dist_build_adapter_setup_node_env_external__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_build_adapter_setup_node_env_external__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_web_globals__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/web/globals */ \"(middleware)/./node_modules/next/dist/server/web/globals.js\");\n/* harmony import */ var next_dist_server_web_globals__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_web_globals__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var next_dist_server_web_adapter__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/web/adapter */ \"(middleware)/./node_modules/next/dist/server/web/adapter.js\");\n/* harmony import */ var next_dist_server_web_adapter__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_web_adapter__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var next_dist_server_lib_incremental_cache__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! next/dist/server/lib/incremental-cache */ \"(middleware)/./node_modules/next/dist/server/lib/incremental-cache/index.js\");\n/* harmony import */ var next_dist_server_lib_incremental_cache__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_incremental_cache__WEBPACK_IMPORTED_MODULE_3__);\n/* harmony import */ var _src_proxy_ts__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./src/proxy.ts */ \"(middleware)/./src/proxy.ts\");\n/* harmony import */ var next_dist_client_components_is_next_router_error__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! next/dist/client/components/is-next-router-error */ \"(middleware)/./node_modules/next/dist/client/components/is-next-router-error.js\");\n/* harmony import */ var next_dist_client_components_is_next_router_error__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(next_dist_client_components_is_next_router_error__WEBPACK_IMPORTED_MODULE_5__);\n/* harmony import */ var next_dist_server_web_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! next/dist/server/web/utils */ \"(middleware)/./node_modules/next/dist/server/web/utils.js\");\n/* harmony import */ var next_dist_server_web_utils__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_web_utils__WEBPACK_IMPORTED_MODULE_6__);\n\n\n\n\nconst incrementalCacheHandler = null\n// Import the userland code.\n;\n\n\n\nconst mod = {\n    ..._src_proxy_ts__WEBPACK_IMPORTED_MODULE_4__\n};\nconst page = \"/proxy\";\nconst isProxy = page === '/proxy' || page === '/src/proxy';\nconst handlerUserland = (isProxy ? mod.proxy : mod.middleware) || mod.default;\nclass ProxyMissingExportError extends Error {\n    constructor(message){\n        super(message);\n        // Stack isn't useful here, remove it considering it spams logs during development.\n        this.stack = '';\n    }\n}\n// TODO: This spams logs during development. Find a better way to handle this.\n// Removing this will spam \"fn is not a function\" logs which is worse.\nif (typeof handlerUserland !== 'function') {\n    throw new ProxyMissingExportError(`The ${isProxy ? 'Proxy' : 'Middleware'} file \"${page}\" must export a function named \\`${isProxy ? 'proxy' : 'middleware'}\\` or a default function.`);\n}\n// Proxy will only sent out the FetchEvent to next server,\n// so load instrumentation module here and track the error inside proxy module.\nfunction errorHandledHandler(fn) {\n    return async (...args)=>{\n        try {\n            return await fn(...args);\n        } catch (err) {\n            // In development, error the navigation API usage in runtime,\n            // since it's not allowed to be used in proxy as it's outside of react component tree.\n            if (true) {\n                if ((0,next_dist_client_components_is_next_router_error__WEBPACK_IMPORTED_MODULE_5__.isNextRouterError)(err)) {\n                    err.message = `Next.js navigation API is not allowed to be used in ${isProxy ? 'Proxy' : 'Middleware'}.`;\n                    throw err;\n                }\n            }\n            const req = args[0];\n            const url = new URL(req.url);\n            const resource = url.pathname + url.search;\n            await (0,next_dist_server_web_globals__WEBPACK_IMPORTED_MODULE_1__.edgeInstrumentationOnRequestError)(err, {\n                path: resource,\n                method: req.method,\n                headers: Object.fromEntries(req.headers.entries())\n            }, {\n                routerKind: 'Pages Router',\n                routePath: '/proxy',\n                routeType: 'proxy',\n                revalidateReason: undefined\n            });\n            throw err;\n        }\n    };\n}\nconst internalHandler = (opts)=>{\n    return (0,next_dist_server_web_adapter__WEBPACK_IMPORTED_MODULE_2__.adapter)({\n        ...opts,\n        IncrementalCache: next_dist_server_lib_incremental_cache__WEBPACK_IMPORTED_MODULE_3__.IncrementalCache,\n        incrementalCacheHandler,\n        page,\n        handler: errorHandledHandler(handlerUserland)\n    });\n};\nasync function handler(request, ctx) {\n    const result = await internalHandler({\n        request: {\n            url: request.url,\n            method: request.method,\n            headers: (0,next_dist_server_web_utils__WEBPACK_IMPORTED_MODULE_6__.toNodeOutgoingHttpHeaders)(request.headers),\n            nextConfig: {\n                basePath: \"\",\n                i18n: \"\",\n                trailingSlash: Boolean(false),\n                experimental: {\n                    cacheLife: {\"default\":{\"stale\":300,\"revalidate\":900,\"expire\":4294967294},\"seconds\":{\"stale\":30,\"revalidate\":1,\"expire\":60},\"minutes\":{\"stale\":300,\"revalidate\":60,\"expire\":3600},\"hours\":{\"stale\":300,\"revalidate\":3600,\"expire\":86400},\"days\":{\"stale\":300,\"revalidate\":86400,\"expire\":604800},\"weeks\":{\"stale\":300,\"revalidate\":604800,\"expire\":2592000},\"max\":{\"stale\":300,\"revalidate\":2592000,\"expire\":31536000}},\n                    authInterrupts: Boolean(false),\n                    clientParamParsingOrigins: []\n                }\n            },\n            page: {\n                name: page\n            },\n            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body ?? undefined : undefined,\n            waitUntil: ctx.waitUntil,\n            requestMeta: ctx.requestMeta,\n            signal: ctx.signal || new AbortController().signal\n        }\n    });\n    ctx.waitUntil == null ? void 0 : ctx.waitUntil.call(ctx, result.waitUntil);\n    return result.response;\n}\n// backwards compat\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (internalHandler);\n\n//# sourceMappingURL=middleware.js.map\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKG1pZGRsZXdhcmUpLy4vbm9kZV9tb2R1bGVzL25leHQvZGlzdC9idWlsZC93ZWJwYWNrL2xvYWRlcnMvbmV4dC1taWRkbGV3YXJlLWxvYWRlci5qcz9hYnNvbHV0ZVBhZ2VQYXRoPSUyRmRhdGElMkZkYXRhJTJGY29tLnRlcm11eCUyRmZpbGVzJTJGaG9tZSUyRnBsdXMlMkZzcmMlMkZwcm94eS50cyZwYWdlPSUyRnByb3h5JnJvb3REaXI9JTJGZGF0YSUyRmRhdGElMkZjb20udGVybXV4JTJGZmlsZXMlMkZob21lJTJGcGx1cyZtYXRjaGVycz0mcHJlZmVycmVkUmVnaW9uPSZtaWRkbGV3YXJlQ29uZmlnPWUzMCUzRCEiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQXlEO0FBQ25CO0FBQ2lCO0FBQ21CO0FBQzFFO0FBQ0E7QUFDQSxDQUF1QztBQUMwQztBQUNJO0FBQ2Q7QUFDdkU7QUFDQSxPQUFPLDBDQUFJO0FBQ1g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDZDQUE2QyxrQ0FBa0MsUUFBUSxLQUFLLG1DQUFtQyxpQ0FBaUM7QUFDaEs7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBLGdCQUFnQixJQUFxQztBQUNyRCxvQkFBb0IsbUdBQWlCO0FBQ3JDLHlGQUF5RixpQ0FBaUM7QUFDMUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWtCLCtGQUFpQztBQUNuRDtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFdBQVcscUVBQU87QUFDbEI7QUFDQSx3QkFBd0I7QUFDeEI7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQixxRkFBeUI7QUFDOUM7QUFDQSwwQkFBMEIsRUFBNEI7QUFDdEQsc0JBQXNCLEVBQThCO0FBQ3BELHVDQUF1QyxLQUFpQztBQUN4RTtBQUNBLCtCQUErQiwyWUFBNkI7QUFDNUQsNENBQTRDLEtBQStDO0FBQzNGLCtDQUErQyxFQUErQztBQUM5RjtBQUNBLGFBQWE7QUFDYjtBQUNBO0FBQ0EsYUFBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpRUFBZSxlQUFlLEVBQUM7O0FBRS9CIiwic291cmNlcyI6WyIiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFwibmV4dC9kaXN0L2J1aWxkL2FkYXB0ZXIvc2V0dXAtbm9kZS1lbnYuZXh0ZXJuYWxcIjtcbmltcG9ydCBcIm5leHQvZGlzdC9zZXJ2ZXIvd2ViL2dsb2JhbHNcIjtcbmltcG9ydCB7IGFkYXB0ZXIgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci93ZWIvYWRhcHRlclwiO1xuaW1wb3J0IHsgSW5jcmVtZW50YWxDYWNoZSB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL2xpYi9pbmNyZW1lbnRhbC1jYWNoZVwiO1xuY29uc3QgaW5jcmVtZW50YWxDYWNoZUhhbmRsZXIgPSBudWxsXG4vLyBJbXBvcnQgdGhlIHVzZXJsYW5kIGNvZGUuXG5pbXBvcnQgKiBhcyBfbW9kIGZyb20gXCIuL3NyYy9wcm94eS50c1wiO1xuaW1wb3J0IHsgZWRnZUluc3RydW1lbnRhdGlvbk9uUmVxdWVzdEVycm9yIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvd2ViL2dsb2JhbHNcIjtcbmltcG9ydCB7IGlzTmV4dFJvdXRlckVycm9yIH0gZnJvbSBcIm5leHQvZGlzdC9jbGllbnQvY29tcG9uZW50cy9pcy1uZXh0LXJvdXRlci1lcnJvclwiO1xuaW1wb3J0IHsgdG9Ob2RlT3V0Z29pbmdIdHRwSGVhZGVycyB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL3dlYi91dGlsc1wiO1xuY29uc3QgbW9kID0ge1xuICAgIC4uLl9tb2Rcbn07XG5jb25zdCBwYWdlID0gXCIvcHJveHlcIjtcbmNvbnN0IGlzUHJveHkgPSBwYWdlID09PSAnL3Byb3h5JyB8fCBwYWdlID09PSAnL3NyYy9wcm94eSc7XG5jb25zdCBoYW5kbGVyVXNlcmxhbmQgPSAoaXNQcm94eSA/IG1vZC5wcm94eSA6IG1vZC5taWRkbGV3YXJlKSB8fCBtb2QuZGVmYXVsdDtcbmNsYXNzIFByb3h5TWlzc2luZ0V4cG9ydEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKG1lc3NhZ2Upe1xuICAgICAgICBzdXBlcihtZXNzYWdlKTtcbiAgICAgICAgLy8gU3RhY2sgaXNuJ3QgdXNlZnVsIGhlcmUsIHJlbW92ZSBpdCBjb25zaWRlcmluZyBpdCBzcGFtcyBsb2dzIGR1cmluZyBkZXZlbG9wbWVudC5cbiAgICAgICAgdGhpcy5zdGFjayA9ICcnO1xuICAgIH1cbn1cbi8vIFRPRE86IFRoaXMgc3BhbXMgbG9ncyBkdXJpbmcgZGV2ZWxvcG1lbnQuIEZpbmQgYSBiZXR0ZXIgd2F5IHRvIGhhbmRsZSB0aGlzLlxuLy8gUmVtb3ZpbmcgdGhpcyB3aWxsIHNwYW0gXCJmbiBpcyBub3QgYSBmdW5jdGlvblwiIGxvZ3Mgd2hpY2ggaXMgd29yc2UuXG5pZiAodHlwZW9mIGhhbmRsZXJVc2VybGFuZCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBQcm94eU1pc3NpbmdFeHBvcnRFcnJvcihgVGhlICR7aXNQcm94eSA/ICdQcm94eScgOiAnTWlkZGxld2FyZSd9IGZpbGUgXCIke3BhZ2V9XCIgbXVzdCBleHBvcnQgYSBmdW5jdGlvbiBuYW1lZCBcXGAke2lzUHJveHkgPyAncHJveHknIDogJ21pZGRsZXdhcmUnfVxcYCBvciBhIGRlZmF1bHQgZnVuY3Rpb24uYCk7XG59XG4vLyBQcm94eSB3aWxsIG9ubHkgc2VudCBvdXQgdGhlIEZldGNoRXZlbnQgdG8gbmV4dCBzZXJ2ZXIsXG4vLyBzbyBsb2FkIGluc3RydW1lbnRhdGlvbiBtb2R1bGUgaGVyZSBhbmQgdHJhY2sgdGhlIGVycm9yIGluc2lkZSBwcm94eSBtb2R1bGUuXG5mdW5jdGlvbiBlcnJvckhhbmRsZWRIYW5kbGVyKGZuKSB7XG4gICAgcmV0dXJuIGFzeW5jICguLi5hcmdzKT0+e1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGZuKC4uLmFyZ3MpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIC8vIEluIGRldmVsb3BtZW50LCBlcnJvciB0aGUgbmF2aWdhdGlvbiBBUEkgdXNhZ2UgaW4gcnVudGltZSxcbiAgICAgICAgICAgIC8vIHNpbmNlIGl0J3Mgbm90IGFsbG93ZWQgdG8gYmUgdXNlZCBpbiBwcm94eSBhcyBpdCdzIG91dHNpZGUgb2YgcmVhY3QgY29tcG9uZW50IHRyZWUuXG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgICAgICAgIGlmIChpc05leHRSb3V0ZXJFcnJvcihlcnIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGVyci5tZXNzYWdlID0gYE5leHQuanMgbmF2aWdhdGlvbiBBUEkgaXMgbm90IGFsbG93ZWQgdG8gYmUgdXNlZCBpbiAke2lzUHJveHkgPyAnUHJveHknIDogJ01pZGRsZXdhcmUnfS5gO1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcmVxID0gYXJnc1swXTtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwocmVxLnVybCk7XG4gICAgICAgICAgICBjb25zdCByZXNvdXJjZSA9IHVybC5wYXRobmFtZSArIHVybC5zZWFyY2g7XG4gICAgICAgICAgICBhd2FpdCBlZGdlSW5zdHJ1bWVudGF0aW9uT25SZXF1ZXN0RXJyb3IoZXJyLCB7XG4gICAgICAgICAgICAgICAgcGF0aDogcmVzb3VyY2UsXG4gICAgICAgICAgICAgICAgbWV0aG9kOiByZXEubWV0aG9kLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IE9iamVjdC5mcm9tRW50cmllcyhyZXEuaGVhZGVycy5lbnRyaWVzKCkpXG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgcm91dGVyS2luZDogJ1BhZ2VzIFJvdXRlcicsXG4gICAgICAgICAgICAgICAgcm91dGVQYXRoOiAnL3Byb3h5JyxcbiAgICAgICAgICAgICAgICByb3V0ZVR5cGU6ICdwcm94eScsXG4gICAgICAgICAgICAgICAgcmV2YWxpZGF0ZVJlYXNvbjogdW5kZWZpbmVkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgIH07XG59XG5jb25zdCBpbnRlcm5hbEhhbmRsZXIgPSAob3B0cyk9PntcbiAgICByZXR1cm4gYWRhcHRlcih7XG4gICAgICAgIC4uLm9wdHMsXG4gICAgICAgIEluY3JlbWVudGFsQ2FjaGUsXG4gICAgICAgIGluY3JlbWVudGFsQ2FjaGVIYW5kbGVyLFxuICAgICAgICBwYWdlLFxuICAgICAgICBoYW5kbGVyOiBlcnJvckhhbmRsZWRIYW5kbGVyKGhhbmRsZXJVc2VybGFuZClcbiAgICB9KTtcbn07XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlcihyZXF1ZXN0LCBjdHgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBpbnRlcm5hbEhhbmRsZXIoe1xuICAgICAgICByZXF1ZXN0OiB7XG4gICAgICAgICAgICB1cmw6IHJlcXVlc3QudXJsLFxuICAgICAgICAgICAgbWV0aG9kOiByZXF1ZXN0Lm1ldGhvZCxcbiAgICAgICAgICAgIGhlYWRlcnM6IHRvTm9kZU91dGdvaW5nSHR0cEhlYWRlcnMocmVxdWVzdC5oZWFkZXJzKSxcbiAgICAgICAgICAgIG5leHRDb25maWc6IHtcbiAgICAgICAgICAgICAgICBiYXNlUGF0aDogcHJvY2Vzcy5lbnYuX19ORVhUX0JBU0VfUEFUSCxcbiAgICAgICAgICAgICAgICBpMThuOiBwcm9jZXNzLmVudi5fX05FWFRfSTE4Tl9DT05GSUcsXG4gICAgICAgICAgICAgICAgdHJhaWxpbmdTbGFzaDogQm9vbGVhbihwcm9jZXNzLmVudi5fX05FWFRfVFJBSUxJTkdfU0xBU0gpLFxuICAgICAgICAgICAgICAgIGV4cGVyaW1lbnRhbDoge1xuICAgICAgICAgICAgICAgICAgICBjYWNoZUxpZmU6IHByb2Nlc3MuZW52Ll9fTkVYVF9DQUNIRV9MSUZFLFxuICAgICAgICAgICAgICAgICAgICBhdXRoSW50ZXJydXB0czogQm9vbGVhbihwcm9jZXNzLmVudi5fX05FWFRfRVhQRVJJTUVOVEFMX0FVVEhfSU5URVJSVVBUUyksXG4gICAgICAgICAgICAgICAgICAgIGNsaWVudFBhcmFtUGFyc2luZ09yaWdpbnM6IHByb2Nlc3MuZW52Ll9fTkVYVF9DTElFTlRfUEFSQU1fUEFSU0lOR19PUklHSU5TXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhZ2U6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBwYWdlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm9keTogcmVxdWVzdC5tZXRob2QgIT09ICdHRVQnICYmIHJlcXVlc3QubWV0aG9kICE9PSAnSEVBRCcgPyByZXF1ZXN0LmJvZHkgPz8gdW5kZWZpbmVkIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgd2FpdFVudGlsOiBjdHgud2FpdFVudGlsLFxuICAgICAgICAgICAgcmVxdWVzdE1ldGE6IGN0eC5yZXF1ZXN0TWV0YSxcbiAgICAgICAgICAgIHNpZ25hbDogY3R4LnNpZ25hbCB8fCBuZXcgQWJvcnRDb250cm9sbGVyKCkuc2lnbmFsXG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBjdHgud2FpdFVudGlsID09IG51bGwgPyB2b2lkIDAgOiBjdHgud2FpdFVudGlsLmNhbGwoY3R4LCByZXN1bHQud2FpdFVudGlsKTtcbiAgICByZXR1cm4gcmVzdWx0LnJlc3BvbnNlO1xufVxuLy8gYmFja3dhcmRzIGNvbXBhdFxuZXhwb3J0IGRlZmF1bHQgaW50ZXJuYWxIYW5kbGVyO1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1taWRkbGV3YXJlLmpzLm1hcFxuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(middleware)/./node_modules/next/dist/build/webpack/loaders/next-middleware-loader.js?absolutePagePath=%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome%2Fplus%2Fsrc%2Fproxy.ts&page=%2Fproxy&rootDir=%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome%2Fplus&matchers=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(middleware)/./src/proxy.ts":
/*!**********************!*\
  !*** ./src/proxy.ts ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   config: () => (/* binding */ config),\n/* harmony export */   \"default\": () => (/* binding */ proxy)\n/* harmony export */ });\n/* harmony import */ var _supabase_ssr__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @supabase/ssr */ \"(middleware)/./node_modules/@supabase/ssr/dist/module/index.js\");\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/server */ \"(middleware)/./node_modules/next/dist/api/server.js\");\n\n\nasync function proxy(request) {\n    let response = next_server__WEBPACK_IMPORTED_MODULE_1__.NextResponse.next({\n        request: {\n            headers: request.headers\n        }\n    });\n    const supabase = (0,_supabase_ssr__WEBPACK_IMPORTED_MODULE_0__.createServerClient)(\"https://rejiniwlnjrixkskyyhi.supabase.co\", \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlamluaXdsbmpyaXhrc2t5eWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODM1MTgsImV4cCI6MjA5MzA1OTUxOH0.FWx75JUlwAG6HAMXeig35sLl6DJCCAKQnSZRXxnneSs\", {\n        cookies: {\n            get (name) {\n                return request.cookies.get(name)?.value;\n            },\n            set (name, value1, options) {\n                request.cookies.set({\n                    name,\n                    value: value1,\n                    ...options\n                });\n                response = next_server__WEBPACK_IMPORTED_MODULE_1__.NextResponse.next({\n                    request: {\n                        headers: request.headers\n                    }\n                });\n                response.cookies.set({\n                    name,\n                    value: value1,\n                    ...options\n                });\n            },\n            remove (name, options) {\n                request.cookies.set({\n                    name,\n                    value,\n                    ...options\n                });\n                response = next_server__WEBPACK_IMPORTED_MODULE_1__.NextResponse.next({\n                    request: {\n                        headers: request.headers\n                    }\n                });\n                response.cookies.delete({\n                    name,\n                    ...options\n                });\n            }\n        }\n    });\n    const { data: { user } } = await supabase.auth.getUser();\n    if (!user && !request.nextUrl.pathname.startsWith('/login')) {\n        return next_server__WEBPACK_IMPORTED_MODULE_1__.NextResponse.redirect(new URL('/login', request.url));\n    }\n    return response;\n}\nconst config = {\n    matcher: [\n        '/((?!_next/static|_next/image|favicon.ico).*)'\n    ]\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKG1pZGRsZXdhcmUpLy4vc3JjL3Byb3h5LnRzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBc0U7QUFDVjtBQUU3QyxlQUFlRSxNQUFNQyxPQUFvQjtJQUNwRCxJQUFJQyxXQUFXSCxxREFBWUEsQ0FBQ0ksSUFBSSxDQUFDO1FBQzdCRixTQUFTO1lBQUVHLFNBQVNILFFBQVFHLE9BQU87UUFBQztJQUN4QztJQUVBLE1BQU1DLFdBQVdQLGlFQUFrQkEsQ0FDL0JRLDBDQUFvQyxFQUNwQ0Esa05BQXlDLEVBQ3pDO1FBQ0lJLFNBQVM7WUFDTEMsS0FBSUMsSUFBWTtnQkFBSSxPQUFPWCxRQUFRUyxPQUFPLENBQUNDLEdBQUcsQ0FBQ0MsT0FBT0M7WUFBTTtZQUM1REMsS0FBSUYsSUFBWSxFQUFFQyxNQUFhLEVBQUVFLE9BQXNCO2dCQUNuRGQsUUFBUVMsT0FBTyxDQUFDSSxHQUFHLENBQUM7b0JBQUVGO29CQUFNQyxPQUFBQTtvQkFBTyxHQUFHRSxPQUFPO2dCQUFDO2dCQUM5Q2IsV0FBV0gscURBQVlBLENBQUNJLElBQUksQ0FBQztvQkFBRUYsU0FBUzt3QkFBRUcsU0FBU0gsUUFBUUcsT0FBTztvQkFBQztnQkFBRTtnQkFDckVGLFNBQVNRLE9BQU8sQ0FBQ0ksR0FBRyxDQUFDO29CQUFFRjtvQkFBTUMsT0FBQUE7b0JBQU8sR0FBR0UsT0FBTztnQkFBQztZQUNuRDtZQUNBQyxRQUFPSixJQUFZLEVBQUVHLE9BQXNCO2dCQUN2Q2QsUUFBUVMsT0FBTyxDQUFDSSxHQUFHLENBQUM7b0JBQUVGO29CQUFNQztvQkFBTyxHQUFHRSxPQUFPO2dCQUFDO2dCQUM5Q2IsV0FBV0gscURBQVlBLENBQUNJLElBQUksQ0FBQztvQkFBRUYsU0FBUzt3QkFBRUcsU0FBU0gsUUFBUUcsT0FBTztvQkFBQztnQkFBRTtnQkFDckVGLFNBQVNRLE9BQU8sQ0FBQ08sTUFBTSxDQUFDO29CQUFFTDtvQkFBTSxHQUFHRyxPQUFPO2dCQUFDO1lBQy9DO1FBQ0o7SUFDSjtJQUdKLE1BQU0sRUFBRUcsTUFBTSxFQUFFQyxJQUFJLEVBQUUsRUFBRSxHQUFHLE1BQU1kLFNBQVNlLElBQUksQ0FBQ0MsT0FBTztJQUV0RCxJQUFJLENBQUNGLFFBQVEsQ0FBQ2xCLFFBQVFxQixPQUFPLENBQUNDLFFBQVEsQ0FBQ0MsVUFBVSxDQUFDLFdBQVc7UUFDekQsT0FBT3pCLHFEQUFZQSxDQUFDMEIsUUFBUSxDQUFDLElBQUlDLElBQUksVUFBVXpCLFFBQVEwQixHQUFHO0lBQzlEO0lBRUEsT0FBT3pCO0FBQ1g7QUFFTyxNQUFNMEIsU0FBUztJQUNsQkMsU0FBUztRQUFDO0tBQWdEO0FBQzlELEVBQUMiLCJzb3VyY2VzIjpbIi9kYXRhL2RhdGEvY29tLnRlcm11eC9maWxlcy9ob21lL3BsdXMvc3JjL3Byb3h5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNyZWF0ZVNlcnZlckNsaWVudCwgdHlwZSBDb29raWVPcHRpb25zIH0gZnJvbSAnQHN1cGFiYXNlL3NzcidcbmltcG9ydCB7IE5leHRSZXNwb25zZSwgdHlwZSBOZXh0UmVxdWVzdCB9IGZyb20gJ25leHQvc2VydmVyJ1xuXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBwcm94eShyZXF1ZXN0OiBOZXh0UmVxdWVzdCkge1xuICAgIGxldCByZXNwb25zZSA9IE5leHRSZXNwb25zZS5uZXh0KHtcbiAgICAgICAgcmVxdWVzdDogeyBoZWFkZXJzOiByZXF1ZXN0LmhlYWRlcnMgfSxcbiAgICB9KVxuXG4gICAgY29uc3Qgc3VwYWJhc2UgPSBjcmVhdGVTZXJ2ZXJDbGllbnQoXG4gICAgICAgIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX1NVUEFCQVNFX1VSTCEsXG4gICAgICAgIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX1NVUEFCQVNFX0FOT05fS0VZISxcbiAgICAgICAge1xuICAgICAgICAgICAgY29va2llczoge1xuICAgICAgICAgICAgICAgIGdldChuYW1lOiBzdHJpbmcpIHsgcmV0dXJuIHJlcXVlc3QuY29va2llcy5nZXQobmFtZSk/LnZhbHVlIH0sXG4gICAgICAgICAgICAgICAgc2V0KG5hbWU6IHN0cmluZywgdmFsdWU6IHN0cmluZywgb3B0aW9uczogQ29va2llT3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0LmNvb2tpZXMuc2V0KHsgbmFtZSwgdmFsdWUsIC4uLm9wdGlvbnMgfSlcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2UgPSBOZXh0UmVzcG9uc2UubmV4dCh7IHJlcXVlc3Q6IHsgaGVhZGVyczogcmVxdWVzdC5oZWFkZXJzIH0gfSlcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2UuY29va2llcy5zZXQoeyBuYW1lLCB2YWx1ZSwgLi4ub3B0aW9ucyB9KVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVtb3ZlKG5hbWU6IHN0cmluZywgb3B0aW9uczogQ29va2llT3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0LmNvb2tpZXMuc2V0KHsgbmFtZSwgdmFsdWUsIC4uLm9wdGlvbnMgfSlcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2UgPSBOZXh0UmVzcG9uc2UubmV4dCh7IHJlcXVlc3Q6IHsgaGVhZGVyczogcmVxdWVzdC5oZWFkZXJzIH0gfSlcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2UuY29va2llcy5kZWxldGUoeyBuYW1lLCAuLi5vcHRpb25zIH0pXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICApXG5cbiAgICBjb25zdCB7IGRhdGE6IHsgdXNlciB9IH0gPSBhd2FpdCBzdXBhYmFzZS5hdXRoLmdldFVzZXIoKVxuXG4gICAgaWYgKCF1c2VyICYmICFyZXF1ZXN0Lm5leHRVcmwucGF0aG5hbWUuc3RhcnRzV2l0aCgnL2xvZ2luJykpIHtcbiAgICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5yZWRpcmVjdChuZXcgVVJMKCcvbG9naW4nLCByZXF1ZXN0LnVybCkpXG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3BvbnNlXG59XG5cbmV4cG9ydCBjb25zdCBjb25maWcgPSB7XG4gICAgbWF0Y2hlcjogWycvKCg/IV9uZXh0L3N0YXRpY3xfbmV4dC9pbWFnZXxmYXZpY29uLmljbykuKiknXSxcbn1cbiJdLCJuYW1lcyI6WyJjcmVhdGVTZXJ2ZXJDbGllbnQiLCJOZXh0UmVzcG9uc2UiLCJwcm94eSIsInJlcXVlc3QiLCJyZXNwb25zZSIsIm5leHQiLCJoZWFkZXJzIiwic3VwYWJhc2UiLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfU1VQQUJBU0VfVVJMIiwiTkVYVF9QVUJMSUNfU1VQQUJBU0VfQU5PTl9LRVkiLCJjb29raWVzIiwiZ2V0IiwibmFtZSIsInZhbHVlIiwic2V0Iiwib3B0aW9ucyIsInJlbW92ZSIsImRlbGV0ZSIsImRhdGEiLCJ1c2VyIiwiYXV0aCIsImdldFVzZXIiLCJuZXh0VXJsIiwicGF0aG5hbWUiLCJzdGFydHNXaXRoIiwicmVkaXJlY3QiLCJVUkwiLCJ1cmwiLCJjb25maWciLCJtYXRjaGVyIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(middleware)/./src/proxy.ts\n");

/***/ }),

/***/ "../app-render/after-task-async-storage.external":
/*!***********************************************************************************!*\
  !*** external "next/dist/server/app-render/after-task-async-storage.external.js" ***!
  \***********************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/server/app-render/after-task-async-storage.external.js");

/***/ }),

/***/ "../app-render/work-async-storage.external":
/*!*****************************************************************************!*\
  !*** external "next/dist/server/app-render/work-async-storage.external.js" ***!
  \*****************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/server/app-render/work-async-storage.external.js");

/***/ }),

/***/ "../app-render/work-unit-async-storage.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/app-render/work-unit-async-storage.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");

/***/ }),

/***/ "./memory-cache.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/lib/incremental-cache/memory-cache.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/server/lib/incremental-cache/memory-cache.external.js");

/***/ }),

/***/ "./shared-cache-controls.external":
/*!*******************************************************************************************!*\
  !*** external "next/dist/server/lib/incremental-cache/shared-cache-controls.external.js" ***!
  \*******************************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/server/lib/incremental-cache/shared-cache-controls.external.js");

/***/ }),

/***/ "./tags-manifest.external":
/*!***********************************************************************************!*\
  !*** external "next/dist/server/lib/incremental-cache/tags-manifest.external.js" ***!
  \***********************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/server/lib/incremental-cache/tags-manifest.external.js");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ "next/dist/build/adapter/setup-node-env.external":
/*!******************************************************************!*\
  !*** external "next/dist/build/adapter/setup-node-env.external" ***!
  \******************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/build/adapter/setup-node-env.external");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "node:async_hooks":
/*!***********************************!*\
  !*** external "node:async_hooks" ***!
  \***********************************/
/***/ ((module) => {

module.exports = require("node:async_hooks");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("path");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("./webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/@supabase","vendor-chunks/tslib","vendor-chunks/iceberg-js","vendor-chunks/cookie","vendor-chunks/@swc"], () => (__webpack_exec__("(middleware)/./node_modules/next/dist/build/webpack/loaders/next-middleware-loader.js?absolutePagePath=%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome%2Fplus%2Fsrc%2Fproxy.ts&page=%2Fproxy&rootDir=%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome%2Fplus&matchers=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();