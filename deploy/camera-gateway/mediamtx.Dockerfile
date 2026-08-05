# Config, runtime bind-mount yerine imaja gömülür (Coolify compose'da göreli
# dosya mount'ları app data dizinine remap edilir ve kırılır — bilinen davranış).
# Sürüm pini burada; latest YASAK.
FROM bluenviron/mediamtx:1.20.0
COPY mediamtx.yml /mediamtx.yml
