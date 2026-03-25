

function renderActiveEffectsChanges(activeEffectConfig, html, data) {
    const section = html.querySelector("section[data-tab='effects']");
    if (!section) return;

    const datalist = document.createElement("datalist");
    datalist.id = "attribute-key-list";

    const inputFields = section.querySelectorAll(".key input");
    inputFields.forEach(input => input.setAttribute("list", datalist.id));

    const attributeKeys = [];

    for (const model of Object.values(CONFIG.Actor.dataModels)) {
        model.schema.apply(function () {
            if (!(this instanceof foundry.data.fields.SchemaField)) {
                attributeKeys.push({
                    key: this.fieldPath,
                    label: this.label,
                });
            }
        });
    }

    attributeKeys
        .sort((a, b) => a.key.localeCompare(b.key))
        .forEach(({ key, label }) => {
            const option = document.createElement("option");
            option.value = key;
            if (label) option.label = label;
            datalist.appendChild(option);
        });

    section.appendChild(datalist);
}



function renderDuration(activeEffectConfig, html, data) {
    CONFIG.ui.vrylEffectShowHideSection = function vrylEffectShowHideSection(dropdown, container, selector, uuid) {
        const sections = container.querySelectorAll(selector);

        for (const section of sections) {
            if (section.dataset.dropdownSection == dropdown.value) {
                section.style.display = 'flex';
            }
            else {
                section.style.display = 'none';

                const inputs = section.querySelectorAll(`input`);

                for (const input of inputs)
                    input.value = '';
            }
        }

        fromUuid(uuid).then(results => {
            results.setFlag('vryl', 'isInstant', dropdown.value == "instant");
            results.isTemporary = dropdown.value == "temporary";
        });
    }

    const section = html.querySelector("section[data-tab='duration']");
    if (!section) return;

    const oldSectionData = structuredClone({
        classList: Array.from(section.classList),
        dataset: Object.entries(section.dataset),
    });

    const temporaryHTML = section.innerHTML;
    let currentType = "passive";
    if (data.document.getFlag('vryl', 'isInstant'))
        currentType = "instant";
    else if (data.document.isTemporary)
        currentType = "temporary";

    const selector = ".durationSection:not(select)";
    const content = `<section>
    <select id="selector" class="durationSection" onchange="CONFIG.ui.vrylEffectShowHideSection(this, this.parentElement, '${selector}', '${data.document.uuid}')">
        <option value="passive" ${currentType == "passive" ? "selected" : ""}>Passive</option>
        <option value="instant" ${currentType == "instant" ? "selected" : ""}>Instant</option>
    </select>
    <div class="durationSection flexcol" data-dropdown-section="instant">
    </div>
    <div class="durationSection flexcol" data-dropdown-section="temporary">
        ${temporaryHTML}
    </div>
    </section>
    `;

    section.innerHTML = content;

    CONFIG.ui.vrylEffectShowHideSection(section.querySelector("select.durationSection"), section, selector, data.document.uuid);
}

/**
 * Adds a datalist helper for suggesting valid Actor attribute keys in the ActiveEffect config dialog.
 */
Hooks.on("renderActiveEffectConfig", (activeEffectConfig, html, data) => {
    console.log(activeEffectConfig);
    console.log(html);
    console.log(data);

    renderDuration(activeEffectConfig, html, data);
});

Hooks.on("updateActiveEffect", (effect, changes, options, userId) => {
    // Your code here
});