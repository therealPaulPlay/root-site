package com.paulplay.rootconnect;

import android.content.SharedPreferences;
import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeStorage")
public class NativeStoragePlugin extends Plugin {
    static final String PREFS_NAME = "root_native_storage";
    static final String STORAGE_KEY = "pairedProducts";

    @PluginMethod
    public void sync(PluginCall call) {
        String products = call.getString("products");
        if (products == null) {
            call.reject("Missing products parameter");
            return;
        }

        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(STORAGE_KEY, products).apply();
        call.resolve();
    }
}
