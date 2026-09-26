# Public disposable interoperability fixtures

Generated through the local Alberich Web revision 66 UI on 26 September 2026.
These books are deliberately public test data. NEVER use them for real messages.

- `web-daily.json`: V3 daily keys, September 2026.
- `web-{24h,4h,1h}.alb3cb2`: independent monthly full keys in unchanged CBQR2.
- `*-message.json`: public family-style UTF-8 plaintext and actual Web ciphertext.

`NkbFamilyCodebookTest` requires `-e nkb_family true`, refuses non-NKB packages,
and uses isolated preferences and a separate SQLite security database. It checks
that the existing device networks/keys remain unchanged. Sending with these
monthly fixtures requires the device date to fall within September 2026;
decryption and the explicit historical day-selection test do not depend on that.
Generated Android return fixtures are written only to explicitly named
`cache/nkb_family_generated_*` test files for the authorized host comparison.
The host should delete those files after reading them.
