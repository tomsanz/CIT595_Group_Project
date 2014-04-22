#include "pebble.h"
#include "setting_window.c"
// Main window global variables
static Window *window;

static TextLayer *temperature_now_layer;
static TextLayer *temperature_avg_layer;
static TextLayer *temperature_min_layer;
static TextLayer *temperature_max_layer;

static AppSync sync;
static uint8_t sync_buffer[1024];
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
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Dictionary Error: %d", dict_error);
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

static void init_text_layer(TextLayer **text_layer, int y_axis, Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  *text_layer = text_layer_create(GRect(0, y_axis, 144, 40));
  text_layer_set_text_color(*text_layer, GColorWhite);
  text_layer_set_background_color(*text_layer, GColorClear);
  text_layer_set_font(*text_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_text_alignment(*text_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(*text_layer));
}

static void window_init(Window *window) {
  init_text_layer(&temperature_now_layer, 0, window);
  init_text_layer(&temperature_avg_layer, 40, window);
  init_text_layer(&temperature_min_layer, 80, window);
  init_text_layer(&temperature_max_layer, 120, window);
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
  app_sync_init(&sync, sync_buffer, 
                sizeof(sync_buffer),
                //dict_calc_buffer_size_from_tuplets(initial_values, ARRAY_LENGTH(initial_values)), 
                initial_values, 
                ARRAY_LENGTH(initial_values),
                sync_tuple_changed_callback, 
                sync_error_callback, NULL);

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
}

/* Called when select button is clicked*/
void select_click_handler(ClickRecognizerRef recognizer, void *context) {
  window_stack_push(setting_window, true /* animated */);
  /*Tuplet to_send_values[] = {
    TupletCString(WEATHER_NOW_KEY, "Now: Updating"),
    TupletCString(WEATHER_AVG_KEY, "Avg: Updating"),
    TupletCString(WEATHER_MAX_KEY, "Max: Updating"),
    TupletCString(WEATHER_MIN_KEY, "Min: Updating"),
  };
  app_sync_set(&sync, to_send_values, ARRAY_LENGTH(to_send_values));*/
}

/* this registers the appropriate function to the appropriate button */
void config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_SELECT, select_click_handler);
  window_single_click_subscribe(BUTTON_ID_DOWN, down_single_click_handler);
}

static void init(void) {
  // Create normal temperature display window.
  window = window_create();
  window_set_background_color(window, GColorBlack);
  window_set_fullscreen(window, true);
  window_set_window_handlers(window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload
  });
  
  // Create setting temperature diplay window.
  setting_window = window_create();
  window_set_window_handlers(setting_window, (WindowHandlers) {
    .load = setting_window_load,
    .unload = setting_window_unload
  });
  
  window_set_click_config_provider(window, config_provider);

  const int inbound_size = 1024;
  const int outbound_size = 1024;
  app_message_open(inbound_size, outbound_size);

  window_stack_push(window, true /* animated */);
}

static void deinit(void) {
  window_destroy(window);
  window_destroy(setting_window);
}

int main(void) {
  APP_LOG(APP_LOG_LEVEL_DEBUG, "App initializing..");
  init();
  APP_LOG(APP_LOG_LEVEL_DEBUG, "APP initialized");
  app_event_loop();
  deinit();
}