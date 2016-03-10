import SandboxBase from './base';
import nativeMethods from './native-methods';
import { getProxyUrl } from '../utils/url';
import XHR_HEADERS from '../../request-pipeline/xhr/headers';
import { getOrigin } from '../utils/destination-location';

const NATIVE_BEHAVIOR = 'hammerhead|xhr|native-behavior';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
var arraySlice = Array.prototype.slice;

export default class XhrSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.XHR_COMPLETED_EVENT = 'hammerhead|event|xhr-completed';
        this.XHR_ERROR_EVENT     = 'hammerhead|event|xhr-error';
        this.XHR_SEND_EVENT      = 'hammerhead|event|xhr-send';

        var xhr = new nativeMethods.XMLHttpRequest();

        this.corsSupported = typeof xhr.withCredentials !== 'undefined';
    }

    static createNativeXHR () {
        var xhr = new window.XMLHttpRequest();

        xhr[NATIVE_BEHAVIOR] = true;

        return xhr;
    }

    attach (window) {
        super.attach(window);

        var xhrSandbox          = this;
        var xmlHttpRequestProto = window.XMLHttpRequest.prototype;

        xmlHttpRequestProto.abort = function () {
            nativeMethods.xmlHttpRequestAbort.call(this);
            if (!this[NATIVE_BEHAVIOR]) {
                xhrSandbox.emit(xhrSandbox.XHR_ERROR_EVENT, {
                    err: new Error('XHR aborted'),
                    xhr: this
                });
            }
        };

        // NOTE: Redirect all requests to the Hammerhead proxy and ensure that requests don't
        // violate Same Origin Policy.
        xmlHttpRequestProto.open = function (method, url, async, user, password) {
            // NOTE: Emulate CORS, so that 3rd party libs (e.g. jQuery) allow requests with the proxy host as well as
            // the destination page host.
            if (!xhrSandbox.corsSupported)
                this.withCredentials = false;

            if (!this[NATIVE_BEHAVIOR])
                url = getProxyUrl(url);

            // NOTE: The 'async' argument is true by default. However, when the 'async' argument is set to undefined,
            // a browser (Chrome, FireFox) sets it to 'false', and a request becomes synchronous (B238528).
            if (arguments.length === 2)
                nativeMethods.xmlHttpRequestOpen.call(this, method, url);
            else
                nativeMethods.xmlHttpRequestOpen.call(this, method, url, async, user, password);
        };

        xmlHttpRequestProto.send = function () {
            if (!this[NATIVE_BEHAVIOR]) {
                var xhr = this;

                xhrSandbox.emit(xhrSandbox.XHR_SEND_EVENT, { xhr });

                var orscHandler = () => {
                    if (this.readyState === 4)
                        xhrSandbox.emit(xhrSandbox.XHR_COMPLETED_EVENT, { xhr });
                };

                // NOTE: If we're using the sync mode or the response is in cache and the object has been retrieved
                // directly (IE6 & IE7), we need to raise the callback manually.
                if (this.readyState === 4)
                    orscHandler();
                else {
                    // NOTE: Get out of the current execution tick and then proxy onreadystatechange,
                    // because jQuery assigns a handler after the send() method was called.
                    nativeMethods.setTimeout.call(xhrSandbox.window, () => {
                        // NOTE: If the state is already changed, we just call the handler without proxying
                        // onreadystatechange.
                        if (this.readyState === 4)
                            orscHandler();

                        else if (typeof this.onreadystatechange === 'function') {
                            var originalHandler = this.onreadystatechange;

                            this.onreadystatechange = progress => {
                                orscHandler();
                                originalHandler.call(this, progress);
                            };
                        }
                        else
                            this.addEventListener('readystatechange', orscHandler, false);
                    }, 0);
                }

                // NOTE: Add the XHR request mark, so that a proxy can recognize a request as a XHR request. As all
                // requests are passed to the proxy, we need to perform Same Origin Policy compliance checks on the
                // server side. So, we pass the CORS support flag to inform the proxy that it can analyze the
                // Access-Control_Allow_Origin flag and skip "preflight" requests.
                this.setRequestHeader(XHR_HEADERS.requestMarker, 'true');

                this.setRequestHeader(XHR_HEADERS.origin, getOrigin());

                if (xhrSandbox.corsSupported)
                    this.setRequestHeader(XHR_HEADERS.corsSupported, 'true');

                if (this.withCredentials)
                    this.setRequestHeader(XHR_HEADERS.withCredentials, 'true');
            }

            nativeMethods.xmlHttpRequestSend.apply(this, arguments);
        };

        xmlHttpRequestProto.addEventListener = function () {
            var xhr  = this;
            var args = arraySlice.call(arguments);

            if (!this[NATIVE_BEHAVIOR]) {
                if (typeof args[1] === 'function') {
                    this.eventHandlers = this.eventHandlers || [];

                    var eventHandlers  = this.eventHandlers;
                    var originHandler  = args[1];
                    var wrappedHandler = function () {
                        originHandler.apply(xhr, arguments);
                    };

                    args[1] = wrappedHandler;

                    eventHandlers.push({
                        origin:  originHandler,
                        wrapped: wrappedHandler
                    });
                }
            }

            return nativeMethods.xmlHttpRequestAddEventListener.apply(this, args);
        };

        xmlHttpRequestProto.removeEventListener = function () {
            var args = arraySlice.call(arguments);

            if (!this[NATIVE_BEHAVIOR]) {
                if (typeof args[1] === 'function') {
                    this.eventHandlers = this.eventHandlers || [];

                    var eventHandlers = this.eventHandlers;

                    for (var i = 0; i < eventHandlers.length; i++) {
                        if (eventHandlers[i].origin === args[1]) {
                            args[1] = eventHandlers[i].wrapped;
                            eventHandlers.splice(i, 1);

                            break;
                        }
                    }
                }
            }

            return nativeMethods.xmlHttpRequestRemoveEventListener.apply(this, args);
        };
    }
}
