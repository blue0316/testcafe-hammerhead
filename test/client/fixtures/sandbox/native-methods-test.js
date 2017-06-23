var nativeMethods = hammerhead.nativeMethods;

if (nativeMethods.performanceNow) {
    test('performanceNow', function () {
        var now = nativeMethods.performanceNow();

        ok(!isNaN(parseFloat(now)));
    });
}

if (nativeMethods.inputValueSetter) {
    test('correct value property setters are saved for the input and textarea elements', function () {
        var input                 = document.createElement('input');
        var inputValueGetter      = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get;
        var textArea              = document.createElement('textarea');
        var textAreaValueGetter   = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').get;
        var testNativeValueSetter = function (el, setter, getter) {
            Object.defineProperty(el, 'value', {
                get: function () {
                    return getter.call(el);
                },
                set: function (value) {
                    return value;
                }
            });

            el.value = '123';

            strictEqual(el.value, '');

            setter.call(el, '123');

            strictEqual(el.value, '123');
        };

        testNativeValueSetter(input, nativeMethods.inputValueSetter, inputValueGetter);
        testNativeValueSetter(textArea, nativeMethods.textAreaValueSetter, textAreaValueGetter);
    });
}
