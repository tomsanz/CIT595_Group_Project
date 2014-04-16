#include "pebble.h"

static Window *window;

static TextLayer *temperature_now_layer;
static TextLayer *temperature_avg_layer;
static TextLayer *temperature_min_layer;
static TextLayer *temperature_max_layer;

static AppSync sync;
static uint8_t sync_buffer[256];
static uint8_t temperature_mode;

enum TemperatureMode {
  CELSIUS = 100,
  FAHRENHEIT = 101 
};
  
enum WeatherKey {
  WEATHER_AVG_KEY = 0, // TUPLE_CSTRING
  WEATHER_NOW_KEY = 1,  // TUPLE_CSTRING
  WEATHER_MIN_KEY = 2,
  WEATHER_MAX_KEY = 3,
  WEATHER_MODE = 5 // TUPLE_INTEGER swap between F and C mode
};

static void sync_error_callback(DictionaryResult dict_error, AppMessageResult app_message_error, void *context) {
  APP_LOG(APP_LOG_LEVEL_DEBUG, "App Message Sync Error: %d", app_message_error);
}

static void sync_tuple_changed_callback(const uint32_t key, const Tuple* new_tuple, const Tuple* old_tuple, void* context) {
  const char *new_value = new_tuple->value->cstring;
  switch (key) {
    case WEATHER_NOW_KEY:
      text_layer_set_text(temperature_now_layer, new_value);
      break;
    case WEATHER_MAX_KEY:
      text_layer_set_text(temperature_max_layer, new_value);
      break;
    case WEATHER_MIN_KEY:
      text_layer_set_text(temperature_min_layer, new_value);      
      break;
    case WEATHER_AVG_KEY:
      text_layer_set_text(temperature_avg_layer, new_value);      
      break;
    case WEATHER_MODE:
      temperature_mode = new_tuple->value->uint8;
      break;
  }
}

static void window_init(Window *window) {
  Layer *window_layer = window_get_root_layer(window);

  temperature_now_layer = text_layer_create(GRect(0, 0, 144, 40));
  text_layer_set_text_color(temperature_now_layer, GColorWhite);
  text_layer_set_background_color(temperature_now_layer, GColorClear);
  text_layer_set_font(temperature_now_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_text_alignment(temperature_now_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(temperature_now_layer));

  temperature_avg_layer = text_layer_create(GRect(0, 40, 144, 40));
  text_layer_set_text_color(temperature_avg_layer, GColorWhite);
  text_layer_set_background_color(temperature_avg_layer, GColorClear);
  text_layer_set_font(temperature_avg_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_text_alignment(temperature_avg_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(temperature_avg_layer));

  temperature_min_layer = text_layer_create(GRect(0, 80, 144, 40));
  text_layer_set_text_color(temperature_min_layer, GColorWhite);
  text_layer_set_background_color(temperature_min_layer, GColorClear);
  text_layer_set_font(temperature_min_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_text_alignment(temperature_min_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(temperature_min_layer));

  temperature_max_layer = text_layer_create(GRect(0, 120, 144, 40));
  text_layer_set_text_color(temperature_max_layer, GColorWhite);
  text_layer_set_background_color(temperature_max_layer, GColorClear);
  text_layer_set_font(temperature_max_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_text_alignment(temperature_max_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(temperature_max_layer));
}


static void window_load(Window *window) {
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Default window loading...");
  window_init(window);
  Tuplet initial_values[] = {
    TupletCString(WEATHER_NOW_KEY, "Now: N/A"),
    TupletCString(WEATHER_AVG_KEY, "Avg: N/A"),
    TupletCString(WEATHER_MAX_KEY, "Max: N/A"),
    TupletCString(WEATHER_MIN_KEY, "Min: N/A"),
    TupletInteger(WEATHER_MODE, CELSIUS),
  };
  app_sync_init(&sync, sync_buffer, sizeof(sync_buffer), initial_values, ARRAY_LENGTH(initial_values),
      sync_tuple_changed_callback, sync_error_callback, NULL);

  APP_LOG(APP_LOG_LEVEL_DEBUG, "Window successfully loaded.");
}

static void window_unload(Window *window) {
  app_sync_deinit(&sync);
  text_layer_destroy(temperature_now_layer);
  text_layer_destroy(temperature_avg_layer);
  text_layer_destroy(temperature_min_layer);
  text_layer_destroy(temperature_max_layer);
}

/* Called when down button is clicked*/
 void down_single_click_handler(ClickRecognizerRef recognizer, void *context) {
   char* new_mode_text;
   
   if (temperature_mode == CELSIUS) 
     new_mode_text = "Fahrenheit";
   else 
     new_mode_text = "Celsius";
   
   Tuplet to_send_values[] = {
     TupletCString(WEATHER_NOW_KEY, "Changing"),
     TupletCString(WEATHER_AVG_KEY, "temperature"),
     TupletCString(WEATHER_MIN_KEY, "mode to"),
     TupletCString(WEATHER_MAX_KEY, new_mode_text),
     TupletInteger(WEATHER_MODE, temperature_mode)
   };
   app_sync_set(&sync, to_send_values, ARRAY_LENGTH(to_send_values));
   
  /* DictionaryIterator *iter;
   app_message_outbox_begin(&iter);
   Tuplet value = TupletCString(WEATHER_MODE, "Convert to F");
   dict_write_tuplet(iter, &value);
   app_message_outbox_send();*/
   
}

/* Called when select button is clicked*/
void select_click_handler(ClickRecognizerRef recognizer, void *context) {
  Tuplet to_send_values[] = {
    TupletCString(WEATHER_NOW_KEY, "Now: Updating"),
    TupletCString(WEATHER_AVG_KEY, "Avg: Updating"),
    TupletCString(WEATHER_MAX_KEY, "Max: Updating"),
    TupletCString(WEATHER_MIN_KEY, "Min: Updating"),
  };
  app_sync_set(&sync, to_send_values, ARRAY_LENGTH(to_send_values));
}

/* this registers the appropriate function to the appropriate button */
void config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_SELECT, select_click_handler);
  window_single_click_subscribe(BUTTON_ID_DOWN, down_single_click_handler);
}

static void init(void) {
  APP_LOG(APP_LOG_LEVEL_DEBUG, "App initializing..");
  // Create normal temperature display window.
  window = window_create();
  window_set_background_color(window, GColorBlack);
  window_set_fullscreen(window, true);
  window_set_window_handlers(window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload
  });
  
  // Set up listeners for each window.
  window_set_click_config_provider(window, config_provider);

  const int inbound_size = 256;
  const int outbound_size = 256;
  app_message_open(inbound_size, outbound_size);

  const bool animated = true;
  window_stack_push(window, animated);
  APP_LOG(APP_LOG_LEVEL_DEBUG, "APP initialized");
}

static void deinit(void) {
  window_destroy(window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}