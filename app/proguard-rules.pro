# Keep Retrofit / Gson DTOs intact for release builds
-keep class app.vaicar.data.** { *; }
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
