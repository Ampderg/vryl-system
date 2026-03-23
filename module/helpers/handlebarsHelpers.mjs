export class VrylHandlebarsHelpers {
    static registerHandlebarsHelpers() {

        //#region Loops
        
        Handlebars.registerHelper('for', function (from, to, incr, block) {
            var accum = '';
            for (var i = from; i < to; i += incr) {
                let data = {
                    index: i,
                    isFirst: i === from,
                    isLast: i + incr >= to,
                    from: from,
                    to: to,
                };
                accum += block.fn(data);
            }
            return accum;
        });

        Handlebars.registerHelper('eachMap', function (context, options) {
            // Clone the array to avoid mutating the original data
            const arr = [...context.values()];

            let ret = "";
            for (let i = 0; i < arr.length; i++) {
                // Pass the sorted item back to the template block
                ret = ret + options.fn(arr[i]);
            }
            return ret;
        });


        Handlebars.registerHelper('eachAttribute', function (context, options) {
            // Clone the array to avoid mutating the original data
            const arr = context.toSorted((a, b) => {
                // Basic sorting logic (e.g., by a 'name' property)
                if (a.type && a.type != b.type) return 0;
                if (a.category && a.category != b.category) return 0;
                return a.sorting - b.sorting;
            });

            let ret = "";
            let rowIndices = new Map();
            for (let i = 0; i < arr.length; i++) {
                if (arr[i].category != undefined) {
                    rowIndices.set(arr[i].category, (rowIndices.get(arr[i].category) ?? 0) + 1);
                    arr[i].indexOdd = rowIndices.get(arr[i].category) % 2 == 0;
                }
                else {
                    arr[i].indexOdd = i % 2 == 0;
                }
                ret = ret + options.fn(arr[i]);
            }
            return ret;
        });

        //#endregion
        
        //#region Comparison

        Handlebars.registerHelper('isEqual', function (a, b) {
            var next = arguments[arguments.length - 1];
            return (a === b) ? next.fn(this) : next.inverse(this);
        });

        Handlebars.registerHelper('lt', function (a, b) {
            var next = arguments[arguments.length - 1];
            return (a < b) ? next.fn(this) : next.inverse(this);
        });
        Handlebars.registerHelper('lte', function (a, b) {
            var next = arguments[arguments.length - 1];
            return (a <= b) ? next.fn(this) : next.inverse(this);
        });
        Handlebars.registerHelper('gt', function (a, b) {
            var next = arguments[arguments.length - 1];
            return (a > b) ? next.fn(this) : next.inverse(this);
        });
        Handlebars.registerHelper('gte', function (a, b) {
            var next = arguments[arguments.length - 1];
            return (a >= b) ? next.fn(this) : next.inverse(this);
        });
        Handlebars.registerHelper('ne', function (a, b) {
            var next = arguments[arguments.length - 1];
            let result = a != b;
            return result ? next.fn(this) : next.inverse(this);
        });

        Handlebars.registerHelper('nenull', function (a, b) {
            var next = arguments[arguments.length - 1];
            let result = a != b;
            if(a == null || a == undefined) result = false;
            return result ? next.fn(this) : next.inverse(this);
        });

        Handlebars.registerHelper("add", function(a, b) {
            return a + b;
        });
        //#endregion
    }
}