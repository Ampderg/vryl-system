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

        Handlebars.registerHelper('entries', function (object) {

            const entries = Object.entries(object);
            const arr = [];

            for (const e of entries) {
                e[1].key = e[0];
                arr.push(e[1]);
            }

            return arr;
        });

        Handlebars.registerHelper('sort', function (array) {

            return array.toSorted((a, b) => {
                if (a.sorting != undefined)
                    return a.sorting - b.sorting;
                return a - b;
            });
        });

        Handlebars.registerHelper('lookupId', function (collection, id) {
            return collection.find(item => item.id === id);
        });

        //#endregion

        //#region Comparison

        /**
 * Tests whether a string begins with the given prefix.
 *
 * ```handlebars
 * {{#startsWith "Goodbye" "Hello, world!"}}
 *   Whoops
 * {{else}}
 *   Bro, do you even hello world?
 * {{/startsWith}}
 * ```
 * @contributor Dan Fox <http://github.com/iamdanfox>
 * @param {String} `prefix`
 * @param {String} `testString`
 * @param {String} `options`
 * @return {String}
 * @block
 * @api public
 */

        Handlebars.registerHelper('startsWith', function (str, str2) {
            return str.startsWith(str2);
        });

        // Handlebars.registerHelper('lt', function (a, b) {
        //     var next = arguments[arguments.length - 1];
        //     return (a < b) ? next.fn(this) : next.inverse(this);
        // });
        // Handlebars.registerHelper('lte', function (a, b) {
        //     var next = arguments[arguments.length - 1];
        //     return (a <= b) ? next.fn(this) : next.inverse(this);
        // });
        // Handlebars.registerHelper('gt', function (a, b) {
        //     var next = arguments[arguments.length - 1];
        //     return (a > b) ? next.fn(this) : next.inverse(this);
        // });
        // Handlebars.registerHelper('gte', function (a, b) {
        //     var next = arguments[arguments.length - 1];
        //     return (a >= b) ? next.fn(this) : next.inverse(this);
        // });
        // Handlebars.registerHelper('ne', function (a, b) {
        //     var next = arguments[arguments.length - 1];
        //     let result = a != b;
        //     return result ? next.fn(this) : next.inverse(this);
        // });

        Handlebars.registerHelper('nenull', function (a, b) {
            var next = arguments[arguments.length - 1];
            let result = a != b;
            if (a == null || a == undefined) result = false;
            return result ? next.fn(this) : next.inverse(this);
        });

        Handlebars.registerHelper("add", function (a, b) {
            return a + b;
        });

        Handlebars.registerHelper('or', function () {
            // Convert arguments object to array and remove the last item (options)
            var args = Array.prototype.slice.call(arguments, 0, -1);
            // Return true if at least one argument is truthy
            return args.some(Boolean);
        });
        //#endregion

        //#region Partials
        foundry.applications.handlebars.loadTemplates({
            attributesList: "systems/vryl/templates/parts/attributes-list.hbs",
            willpower: "systems/vryl/templates/parts/willpower.hbs",
            xp: "systems/vryl/templates/parts/xp.hbs",

            equipmentSlots: "systems/vryl/templates/parts/items/equipmentSlots.hbs",
            equipmentLoadouts: "systems/vryl/templates/parts/items/equipmentLoadouts.hbs",
            inventory: "systems/vryl/templates/parts/items/inventory.hbs",

            effectsList: "systems/vryl/templates/parts/effects-list.hbs",

            combatCards: "systems/vryl/templates/parts/combat/cards.hbs"
        });
    }
}