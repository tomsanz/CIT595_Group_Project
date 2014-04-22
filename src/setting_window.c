#include "pebble.h"

// Setting window variables
#define MENU_ITEM_NUM 3
static Window *setting_window;
static SimpleMenuLayer *menu_layer;
static SimpleMenuSection menu_sections[1];
static SimpleMenuItem menu_items[MENU_ITEM_NUM];

// Default settings:
// refresh every minute, up button send refresh reading, display sensor reading.
static uint8_t refresh_item_index = 2, up_button_index = 1, display_index = 0;
static const char* menu_items_text[] = {
  "Main display",
  "Auto refresh",
  "Up button func"
};
// Default settings:
// refresh every minute, up button send refresh reading, display sensor reading.
static int current_selections[] = {0, 1, 0};
// Total number of options for each menu item.
static int selection_nums[] = {2, 5, 3};
static const char* refresh_options[] = {
  "off",
  "15 seconds",
  "1 minute",
  "5 minutes",
  "15 minutes"
};
static const char* up_button_options[] = {
  "send morse code",
  "refresh reading",
  "pause/resume sensor"
};
static const char* display_button_options[] = {
  "sensor readings",
  "outside vs. sensor"
};

static const char** menu_items_options[] = {display_button_options, refresh_options, up_button_options};

static void setting_window_load(Window *);
static void setting_window_unload(Window *);
static void menu_select_callback(int, void *);
static const char* get_menu_item_subtitle(int, int);  
  

static const char* get_menu_item_subtitle(int menu_item_index, int menu_item_subtitle_index) {
  return menu_items_options[menu_item_index][menu_item_subtitle_index];
}

static int next_item(int i) {
  current_selections[i] = current_selections[i]+ 1;
  current_selections[i] = current_selections[i] % selection_nums[i];
  return current_selections[i];
}

static void menu_select_callback(int index, void *ctx) {
  menu_items[index].subtitle = get_menu_item_subtitle(index, next_item(index));
  layer_mark_dirty(simple_menu_layer_get_layer(menu_layer));
}

static void setting_window_load(Window *window) {
  int i;
  for (i = 0; i< MENU_ITEM_NUM; i++) {
    menu_items[i] = (SimpleMenuItem) {
      .title = menu_items_text[i],
      .subtitle = get_menu_item_subtitle(i, current_selections[i]),
      .callback = menu_select_callback,
    };
  }
  menu_sections[0] = (SimpleMenuSection) {
    .num_items = MENU_ITEM_NUM,
    .items = menu_items
  };
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_frame(window_layer);
  menu_layer = simple_menu_layer_create(bounds, window, menu_sections, 1, NULL);
  layer_add_child(window_layer, simple_menu_layer_get_layer(menu_layer));
}

static void setting_window_unload(Window *window) {
  simple_menu_layer_destroy(menu_layer);
}