Hooks.once('ready', async () => {

    // Your code here, such as checking if a specific module is active:
    if (game.modules.get("barbrawl")?.active) {

        let currentSettings = game.settings.get("barbrawl", "defaultTypeResources");

        if (!currentSettings || currentSettings == {} || (!currentSettings["barbrawl-default"])) {
            let defaultBars = {
                "bar1": {
                    "order": 0,
                    "id": "bar1",
                    "attribute": "combat.hp",
                    "mincolor": "#FF0000",
                    "maxcolor": "#80FF00",
                    "otherVisibility": 50,
                    "ownerVisibility": 50,
                    "gmVisibility": -1,
                    "hideFull": false,
                    "hideEmpty": false,
                    "hideCombat": false,
                    "hideNoCombat": true,
                    "hideHud": false,
                    "position": "bottom-inner",
                    "shareHeight": true,
                    "indentLeft": null,
                    "indentRight": null,
                    "style": "user",
                    "label": "",
                    "invert": false,
                    "subdivisions": null,
                    "subdivisionsOwner": false,
                    "invertDirection": false,
                    "fgImage": "",
                    "bgImage": "",
                    "hideBg": false,
                    "opacity": null
                },
                "bar3": {
                    "order": 1,
                    "id": "bar3",
                    "attribute": "combat.guard",
                    "mincolor": "#FFFFFF",
                    "maxcolor": "#FFFFFF",
                    "otherVisibility": 50,
                    "ownerVisibility": 50,
                    "gmVisibility": -1,
                    "hideFull": false,
                    "hideEmpty": true,
                    "hideCombat": false,
                    "hideNoCombat": true,
                    "hideHud": false,
                    "position": "bottom-inner",
                    "shareHeight": true,
                    "indentLeft": null,
                    "indentRight": null,
                    "style": "user",
                    "label": "",
                    "invert": false,
                    "subdivisions": null,
                    "subdivisionsOwner": false,
                    "invertDirection": false,
                    "fgImage": "",
                    "bgImage": "",
                    "hideBg": true,
                    "opacity": 50
                },
                "bar2": {
                    "order": 2,
                    "id": "bar2",
                    "attribute": "willpower",
                    "mincolor": "#000080",
                    "maxcolor": "#80B3FF",
                    "otherVisibility": 30,
                    "ownerVisibility": 50,
                    "gmVisibility": -1,
                    "hideFull": false,
                    "hideEmpty": false,
                    "hideCombat": false,
                    "hideNoCombat": false,
                    "hideHud": false,
                    "position": "top-inner",
                    "shareHeight": false,
                    "indentLeft": null,
                    "indentRight": null,
                    "style": "user",
                    "label": "",
                    "invert": false,
                    "subdivisions": null,
                    "subdivisionsOwner": false,
                    "invertDirection": false,
                    "fgImage": "",
                    "bgImage": "",
                    "hideBg": false,
                    "opacity": null
                }
            }
            let barConfig = {
                "barbrawl-default": defaultBars,
            }
            game.settings.set("barbrawl", "defaultTypeResources", barConfig);
        }
    }
});