import { ROLL_ACTIONS } from '../helpers/roll-actions.mjs';

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

function renderChanges(activeEffectConfig, html, data) {

    CONFIG.ui.vrylAddEffectFlag = async function (documentUuid) {

        const document = await fromUuid(documentUuid);

        const appliedRollActions = document.getFlag('vryl', 'appliedRollActions');

        const actionData = {
            flags: [],
        }

        const targetAction = {
            action: "n-a",
            actor: 'global',
            data: actionData,
        }
        appliedRollActions.push(targetAction);
        document.setFlag('vryl', 'appliedRollActions', appliedRollActions);

        return targetAction;
    }

    CONFIG.ui.vrylUpdateEffectActionFlags = async function (field, actionName, documentUuid) {

        const document = await fromUuid(documentUuid);

        const appliedRollActions = document.getFlag('vryl', 'appliedRollActions');

        let targetAction = appliedRollActions[parseInt(field.name)];
        if (targetAction == undefined) {
            targetAction = CONFIG.ui.vrylAddEffectFlag(documentUuid);
        }

        let key = field.id;

        if (key == 'action') {
            targetAction.action = field.value;

            const actionSettings = ROLL_ACTIONS.filter((a) => a.action == actionName)[0];

            targetAction.actor = actionSettings.actionOwner == 'global' ? 'global' : document.actor;

            const actionData = {
                flags: [],
            }

            if (actionSettings.flags) {
                for (const [flag, flagSettings] of Object.entries(actionSettings.flags)) {
                    let value;
                    if (actionData.flags[flag] != undefined)
                        value = actionData.flags[flag].value;
                    else
                        value = CONFIG.ui.rollBuilder.getInitialRollFlagValue(actionName, flag);

                    actionData.flags.push({
                        flag: flag,
                        value: value,
                        settings: flagSettings,
                    });
                }
            }

            targetAction.data = actionData;

        }
        else {
            if (key.startsWith('data.')) {
                const tokens = key.split('.');
                const flag = targetAction.data.filter((f) => f.flag == tokens[1]);
                if (flag) {
                    flag[tokens[2]] = field.value;
                }
            }
        }

        document.setFlag('vryl', 'appliedRollActions', appliedRollActions);
    }

    const section = html.querySelector("section[data-tab='changes']");
    if (!section) return;

    let appliedRollActions = data.document.getFlag('vryl', 'appliedRollActions');
    let content = '';

    if (appliedRollActions == undefined) {
        appliedRollActions = [];
        data.document.setFlag('vryl', 'appliedRollActions', appliedRollActions);
    }

    let i = 0;
    for (const action of appliedRollActions) {
        let lineContent = `<div class='flexcol'>`;
        lineContent += `<select name='${i}' id="action" onchange="CONFIG.ui.vrylUpdateEffectActionFlags(this, this.value, '${data.document.uuid}')">`
        lineContent += `<option name='${i}' value='n-a' ${action.action == 'n-a' ? "selected" : ""}></option>`;
        for (const actionSetting of ROLL_ACTIONS) {
            lineContent += `<option value='${actionSetting.action}' ${action.action == actionSetting.action ? "selected" : ""}>${actionSetting.action}</option>`;
        }
        lineContent += `</select>`;

        const actionSettings = ROLL_ACTIONS.filter((a) => a.action == action.action)[0];
        if (actionSettings && actionSettings.flags != undefined && Object.keys(actionSettings.flags).length > 0) {
            lineContent += '<div>';
            for (const [flag, flagSettings] of Object.entries(actionSettings.flags)) {
                lineContent += '<div class="flexrow" style="margin-left: 4em">';
                lineContent += `<span class="fitwidth">${flagSettings.label}</span>`;
                lineContent += `<input name='${i}' style="width: 75%;" id='data.${flag}.value' type='text' onchange="CONFIG.ui.vrylUpdateEffectActionFlags(this, '${action.action}', '${data.document.uuid}')"'>`
                lineContent += '</div>';
            }
            lineContent += '</div>';
        }
        lineContent += `</div>`;
        content += lineContent;
        i++;
    }

    section.innerHTML += `
    <div>
    <header>
    <span>Roll Flags</span>
    <span></span>
    <span></span>
    <span></span>
    <span onclick="CONFIG.ui.vrylAddEffectFlag('${data.document.uuid}')"><i class="fa-regular fa-square-plus"></i></span>
    </header>
    ${content}
    </div>`;
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
            //results.isTemporary = dropdown.value == "temporary";
        });
    }

    CONFIG.ui.vrylSetEffectFlag = async function (flag, value, documentUuid) {
        const document = await fromUuid(documentUuid);
        document.setFlag(CONFIG.SystemId, flag, value);
        }

    const section = html.querySelector("section[data-tab='duration']");
    if (!section) return;

    const oldSectionData = structuredClone({
        classList: Array.from(section.classList),
        dataset: Object.entries(section.dataset),
    });

    const temporaryHTML = section.innerHTML;
    let currentType = "passive";
    
    let instantContent = '';
    if (data.document.getFlag('vryl', 'isInstant'))
    {
        currentType = "instant";

        const promptSetting = data.document.getFlag(CONFIG.SystemId, 'promptSetting');
        instantContent += `<span>Roll Prompt</span>
        <div>
        <select onchange="CONFIG.ui.vrylSetEffectFlag('promptSetting', this.value, '${data.document.uuid}')">
            <option value="never" ${(!promptSetting || promptSetting == "never") ? "selected" : ""} >Never</option>
            <option value="attributesAffected" ${promptSetting == "attributesAffected" ? "selected" : ""}>When Attributes are Affected</option>
            <option value="flagPresent" ${promptSetting == "flagPresent" ? "selected" : ""}>When Roll Flag is Present</option>
            <option value="always" ${promptSetting == "always" ? "selected" : ""}>Always</option>
        </select>`;
        if(promptSetting == "flagPresent")
        {
            const promptFlagSetting = data.document.getFlag(CONFIG.SystemId, 'promptSettingFlag');
            instantContent += `<select onchange="CONFIG.ui.vrylSetEffectFlag('promptSettingFlag', this.value, '${data.document.uuid}')">`;
            const globalActions = ROLL_ACTIONS.filter((a) => a.actionOwner == 'global');
            for(const rollAction of globalActions)
            {
                instantContent += `<option value="${rollAction.action}" ${promptFlagSetting == rollAction.action ? "selected" : ""} >${rollAction.action}</option>`;
            }
            instantContent += "</select>";
        }
        instantContent += '</div>';
    }
    else if (data.document.isTemporary)
        currentType = "temporary";

    const selector = ".durationSection:not(select)";
    const content = `<section>
    <select id="selector" class="durationSection" onchange="CONFIG.ui.vrylEffectShowHideSection(this, this.parentElement, '${selector}', '${data.document.uuid}')">
        <option value="passive" ${currentType == "passive" ? "selected" : ""}>Passive</option>
        <option value="instant" ${currentType == "instant" ? "selected" : ""}>Instant</option>
    </select>
    <div class="durationSection flexcol" data-dropdown-section="instant">
        ${instantContent}
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
    renderChanges(activeEffectConfig, html, data);
});

Hooks.on("updateActiveEffect", (effect, changes, options, userId) => {
    // Your code here
});