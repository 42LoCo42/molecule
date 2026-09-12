{
  outputs = { flake-utils, nixpkgs, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        inherit (pkgs.lib.fileset) toSource unions;

        env = {
          CGO_CFLAGS_ALLOW = "-fno-strict-overflow";
        };
      in
      rec {
        packages.default = pkgs.buildGoModule {
          pname = "molecule";
          version = "1";

          src = toSource {
            root = ./.;
            fileset = unions [
              ./go.mod
              ./go.sum
              ./main.go
            ];
          };

          inherit env;

          nativeBuildInputs = with pkgs; [
            pkg-config
          ];

          buildInputs = with pkgs; [
            pipewire
          ];

          ldflags = [ "-s" ];
          vendorHash = "";
        };

        devShells.default = pkgs.mkShell {
          inputsFrom = builtins.attrValues packages;

          packages = with pkgs; [
            bear
            clang-tools
            nodejs
            pnpm
            websocat
          ];

          inherit env;
        };
      });
}
