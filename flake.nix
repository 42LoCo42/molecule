{
  outputs = { flake-utils, nixpkgs, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        pname = "molecule";
        version = "1.0.0";

        env = {
          CGO_CFLAGS_ALLOW = "-fno-strict-overflow";
        };

        python = pkgs.python3.withPackages (p: with p; [
          fonttools
        ]);
      in
      rec {
        packages = rec {
          default = pkgs.linkFarmFromDrvs pname [ frontend backend ];

          frontend = pkgs.stdenv.mkDerivation (drv: {
            pname = "molecule-frontend";
            inherit version;

            src = ./frontend;

            nativeBuildInputs = with pkgs; [
              nodejs
              pnpm
              pnpmConfigHook
            ];

            pnpmDeps = pkgs.fetchPnpmDeps {
              inherit (drv) pname src version;
              inherit (pkgs) pnpm;
              fetcherVersion = 4;
              hash = "sha256-0d8DqWw7Jf2okZ2wQB48Ek1thbK5Og5O1bNhtZflqi0=";
            };

            buildPhase = ''
              bash build.sh
            '';

            installPhase = ''
              cp -r dist $out
            '';
          });

          backend = pkgs.buildGoModule {
            pname = "${pname}-backend";
            inherit version;

            src = ./backend;

            inherit env;

            nativeBuildInputs = with pkgs; [
              pkg-config
            ];

            buildInputs = with pkgs; [
              pipewire
            ];

            ldflags = [ "-s" ];
            vendorHash = "sha256-0Qxw+MUYVgzgWB8vi3HBYtVXSq/btfh4ZfV/m1chNrA=";
          };
        };

        devShells.default = pkgs.mkShell {
          inputsFrom = builtins.attrValues packages;

          packages = with pkgs; [
            bear
            caddy
            clang-tools
            gdb
            helvum
            just
            livekit-cli
            python
            valgrind
            websocat
            woff2
          ];

          env = env // {
            IOSEVKA = "${pkgs.iosevka}/share/fonts/truetype/Iosevka-Regular.ttf";
          };
        };
      });
}
