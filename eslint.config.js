import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
		plugins: { js, jsdoc },
		extends: ["js/recommended"],
		languageOptions: { globals: globals.browser },
		rules: {
			"@typescript-eslint/no-unused-vars": ["warn", {
				argsIgnorePattern: "^_",
				varsIgnorePattern: "^_",
				caughtErrorsIgnorePattern: "^_",
				destructuredArrayIgnorePattern: "^_",
				reportUsedIgnorePattern: true,
			}],
			...jsdoc.configs["flat/recommended-typescript"].rules,
			"jsdoc/require-jsdoc": ["warn", {
				publicOnly: true,
				require: {
					ArrowFunctionExpression: true,
					ClassDeclaration: true,
					ClassExpression: true,
					FunctionDeclaration: true,
					FunctionExpression: true,
					MethodDefinition: true,
				},
				contexts: [
					"TSInterfaceDeclaration",
					"TSTypeAliasDeclaration",
					":not(TSTypeLiteral) > TSPropertySignature",
				],
			}],
			"jsdoc/require-param": ["warn", {
				checkDestructured: false,
			}],
			"jsdoc/check-param-names": ["warn", {
				checkDestructured: false,
			}],
		},
	},
	tseslint.configs.recommended,
]);
