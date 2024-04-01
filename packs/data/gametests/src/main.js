
import { world, system, EquipmentSlot, Player, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

/**
 * 
 * @param { import('@minecraft/server').Entity } entity 
 * 
 * @returns { import('@minecraft/server').ItemStack[] }
 * 
 */
function fetchInventory(entity) {
  const container = entity.getComponent('inventory').container;
  let inventory = Array.from({ length: container.size }, (_, i) => container.getItem(i) || { typeId: 'air' });
  return (entity instanceof Player) ? inventory.slice(9).concat(inventory.slice(0, 9)) : inventory;
}


/**
 * 
 * @param { import('@minecraft/server').ItemStack[] } inventory 
 * 
 * @returns { string }
 */
function stringifyInventory(inventory) {
  return JSON.stringify(inventory.map(item => {
    return {
      typeId: item?.typeId || 'air',
      amount: item?.amount || 0
    };
  }));
}


/**
 * 
 * @param { import('@minecraft/server').Player } player 
 * 
 * @returns { import('@minecraft/server').ItemStack[] }
 */
function fetchPlayerEquipments(player) {
  const equipment = player.getComponent('equippable');
  return [ equipment.getEquipment(EquipmentSlot.Head), equipment.getEquipment(EquipmentSlot.Chest), equipment.getEquipment(EquipmentSlot.Legs), equipment.getEquipment(EquipmentSlot.Feet), equipment.getEquipment(EquipmentSlot.Offhand) ];
}


/**
 * 
 * @param { import('@minecraft/server').ItemStack[] } equipment 
 * 
 * @returns { string }
 */
function transformEquipmentStatsToString(equipment) {
  return equipment.map(item => {
    return !item?.typeId ? 'b' : 'a';
  }).join('').replace(/[\[\],"]/g, '');
}


/**
 * 
 * Projects the target player's
 * inventory into the inventory
 * viewer entity.
 * 
 * @param { import('@minecraft/server').Player } player 
 * @param { import('@minecraft/server').Player } sourcePlayer 
 */
function projectPlayerInventory(player, sourcePlayer) {

  sourcePlayer.runCommand(`ride @s stop_riding`);

  const inventory = fetchInventory(player);
  const equipment = fetchPlayerEquipments(player);

  const entityProjector = sourcePlayer.dimension.spawnEntity('r4isen1920_invsee:inventory', sourcePlayer.location);
  const entityProjectorContainer = entityProjector.getComponent('inventory').container;

  entityProjector.nameTag = `_r4ui:inventory:${transformEquipmentStatsToString(equipment)}:${player.name}`;

  for (let i = 0; i < 36; i++) {
    if (inventory[i].typeId !== 'air') entityProjectorContainer.setItem(i, inventory[i]);
    else continue;
  }
  for (let i = 45; i < 53; i++) {
    if (equipment[i - 45]?.typeId !== 'air') entityProjectorContainer.setItem(i, equipment[i - 45]);
    else continue;
  }

  sourcePlayer.runCommand(`ride @s start_riding @e[type=r4isen1920_invsee:inventory,c=1] teleport_ride`);
  entityProjector.addTag('invsee');
  entityProjector.setDynamicProperty('r4isen1920_invsee:target', player.id);

  player.setDynamicProperty('r4isen1920_invsee:old_log', stringifyInventory(inventory.concat(equipment)));
  entityProjector.setDynamicProperty('r4isen1920_invsee:old_log', stringifyInventory(fetchInventory(entityProjector)));

}


/**
 * 
 * @param { import('@minecraft/server').Dimension } dimension 
 * 
 * @returns { import('@minecraft/server').Entity[] }
 */
function getInventoryViewerEntities(dimension) {
  return world.getDimension(dimension).getEntities({ type: 'r4isen1920_invsee:inventory', tags: ['invsee'] });
}


/**
 * 
 * @param { import('@minecraft/server').Entity } entityProjector 
 */
function checkSync(entityProjector) {

  const target = world.getEntity(entityProjector.getDynamicProperty('r4isen1920_invsee:target'));

  const playerInventory = stringifyInventory(
    fetchInventory(target)
    .concat(fetchPlayerEquipments(target))
  );
  const viewerInventory = stringifyInventory(fetchInventory(entityProjector));

  if (playerInventory !== target.getDynamicProperty('r4isen1920_invsee:old_log')) {
    pullChange(entityProjector, target);
  } else if (viewerInventory !== entityProjector.getDynamicProperty('r4isen1920_invsee:old_log')) {
    pushChange(entityProjector, target);
  }

  target.setDynamicProperty('r4isen1920_invsee:old_log', playerInventory);
  entityProjector.setDynamicProperty('r4isen1920_invsee:old_log', viewerInventory);

  entityProjector.removeTag('updating');

}


function pullChange(entityProjector, target) {

  if (entityProjector.hasTag('updating')) return;
  entityProjector.addTag('updating');

  const inventory = fetchInventory(target);
  const equipment = fetchPlayerEquipments(target);

  const entityProjectorContainer = entityProjector.getComponent('inventory').container;
  entityProjector.nameTag = `_r4ui:inventory:${transformEquipmentStatsToString(equipment)}:${target.name}`;
  entityProjectorContainer.clearAll();

  for (let i = 0; i < 36; i++) {
    if (inventory[i].typeId !== 'air') entityProjectorContainer.setItem(i, inventory[i]);
    else continue;
  }
  for (let i = 45; i < 53; i++) {
    if (equipment[i - 45]?.typeId !== 'air') entityProjectorContainer.setItem(i, equipment[i - 45]);
    else continue;
  }

}


function pushChange(entityProjector, target) {

  if (entityProjector.hasTag('updating')) return;
  entityProjector.addTag('updating');

  const targetContainer = target.getComponent('inventory').container;
  const targetEquipment = target.getComponent('equippable');

  const viewerInventory = fetchInventory(entityProjector).slice(0, 36);
  const viewerInventorySlice = [...viewerInventory.slice(-9), ...viewerInventory.slice(0, -9)];
  const viewerEquipment = fetchInventory(entityProjector).slice(45, 53);

  entityProjector.nameTag = `_r4ui:inventory:${transformEquipmentStatsToString(viewerEquipment)}:${target.name}`;

  const indexToEquipment = {
    45: EquipmentSlot.Head,
    46: EquipmentSlot.Chest,
    47: EquipmentSlot.Legs,
    48: EquipmentSlot.Feet,
    49: EquipmentSlot.Offhand
  }

  targetContainer.clearAll();
  targetEquipment.setEquipment(EquipmentSlot.Head, new ItemStack('air'));
  targetEquipment.setEquipment(EquipmentSlot.Chest, new ItemStack('air'));
  targetEquipment.setEquipment(EquipmentSlot.Legs, new ItemStack('air'));
  targetEquipment.setEquipment(EquipmentSlot.Feet, new ItemStack('air'));
  targetEquipment.setEquipment(EquipmentSlot.Offhand, new ItemStack('air'));

  for (let i = 0; i < 36; i++) {
    if (viewerInventorySlice[i].typeId !== 'air') targetContainer.setItem(i, viewerInventorySlice[i]);
    else continue;
  }
  for (let i = 45; i < 53; i++) {
    if (viewerEquipment[i - 45].typeId !== 'air') targetEquipment.setEquipment(indexToEquipment[i], viewerEquipment[i - 45]);
    else continue;
  }


}


function showUIPicker(player) {

  let ui = new ActionFormData()
    .title({'translate': 'gui.invsee.title'})
    .body({'translate': 'gui.invsee.body'})
    .button({'translate': 'gui.invsee.search'}, 'textures/ui/icon_multiplayer')

  const playersList = world.getAllPlayers();

  for (const players of playersList) {
    ui.button(players.name);
  }

  ui.show(player).then(result => {
    if (result.canceled) return;

    if (result.selection === 0) {
      showSearchUI(player);
      return;
    }

    if (playersList[result.selection - 1].name === player.name) {
      ui = new ActionFormData()
        .title({'translate': 'gui.invsee.title'})
        .body({'translate': 'gui.invsee.ownInventory'})
        .button({'translate': 'gui.invsee.back'})
        .show(player).then(result => {
        if (result.canceled) return;

        showUIPicker(player);
      });
      return;
    }

    projectPlayerInventory(playersList[result.selection - 1], player);
  });

}


function showSearchUI(player) {
  let ui = new ModalFormData()
    .title({'translate': 'gui.invsee.search'})
    .textField({'translate': 'gui.invsee.textField'}, player.name);

  ui.show(player).then(result => {
    if (result.canceled) {
      showUIPicker(player);
      return;
    }

    const playersList = world.getAllPlayers();
    const searchValue = result.formValues[0].toLowerCase();

    const filteredPlayers = playersList.filter(player => player.name.toLowerCase().includes(searchValue));

    let ui = new ActionFormData();

    if (filteredPlayers.length === 0) {
      ui.title({'translate': 'gui.invsee.search'})
        .body({'translate': 'gui.invsee.notFound', 'with': [searchValue]})
        .button({'translate': 'gui.invsee.searchAgain'}, 'textures/ui/icon_multiplayer');
    } else {
      ui.title({'translate': 'gui.invsee.search'})
        .body({'translate': `gui.invsee.matchFound.${filteredPlayers.length > 1 ? 'plural' : 'singular'}`})
      filteredPlayers.forEach(
        player => {
          const name = player.name;
          const index = name.toLowerCase().indexOf(result.formValues[0].toLowerCase());

          if (index !== -1) {
            const boldName = `§r${name.substring(0, index)}§l${name.substring(index, index + result.formValues[0].length)}§r${name.substring(index + result.formValues[0].length)}§r`;
            ui.button(boldName);
          }
        }
      );
    }

    ui.show(player).then(result => {
      if (result.canceled) {
        showUIPicker(player);
        return;
      };

      if (filteredPlayers[result.selection]?.name === player.name) {
        new ActionFormData()
          .title({'translate': 'gui.invsee.search'})
          .body({'translate': 'gui.invsee.ownInventory'})
          .button({'translate': 'gui.invsee.back'})
          .show(player)
          .then(result => {
            if (result.canceled) return;
            showUIPicker(player);
          });
      } else if (filteredPlayers[result.selection]?.name === undefined) {
        showUIPicker(player);
      } else {
        projectPlayerInventory(filteredPlayers[result.selection], player);
      }
    });
  });
}

system.runTimeout(() => {
  world.afterEvents.itemStartUse.subscribe(
    event => {
      const { itemStack, source } = event;
      if (itemStack.typeId !== 'r4isen1920_invsee:inventory') return;
      showUIPicker(source)
    }
  )
  system.runInterval(() => {
    const inventoryViewerEntities = getInventoryViewerEntities('minecraft:overworld')
                                    .concat(getInventoryViewerEntities('minecraft:nether'))
                                    .concat(getInventoryViewerEntities('minecraft:the_end'));
    inventoryViewerEntities.forEach(entity => {
      checkSync(entity);
    });
  }, 1)
}, 5)
