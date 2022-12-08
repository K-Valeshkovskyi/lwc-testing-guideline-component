public with sharing class TestsGuidelineController {
    @AuraEnabled(cacheable=true)
    public static List<Contact> getContactList() {
        return [
            SELECT
                Id,
                Name,
                FirstName,
                LastName,
                Title,
                Phone,
                Email
            FROM Contact
            WITH SECURITY_ENFORCED
            LIMIT 10
        ];
    }

    
    @AuraEnabled(cacheable=true)
    public static List<Account> getAccountList() {
        return [
            SELECT
                Id,
                Name,
                Rating
            FROM Account
            WITH SECURITY_ENFORCED
            LIMIT 10
        ];
    }

}
