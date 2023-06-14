DROP TABLE Matches;
drop table menteeeducation;
drop table menteeexperience;
drop table menteeskills;
drop table menteeinterest;
drop table mentoreducation;
drop table mentorexperience;
drop table mentorinterest;
drop table mentorskills;
drop table mentorpreference;
drop table extra_mentee;
drop table extra_mentor;
drop table Meetings;
drop table resources;
drop table mentee;
drop table mentor;
DROP TABLE admin;

CREATE TABLE IF NOT EXISTS Mentee (
    mentee_username VARCHAR(50),
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    surname VARCHAR(50),
    email_address VARCHAR(50) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    imagepath varchar(50) DEFAULT 'menteeupload/default.png',
    primary key (mentee_username)
    );

    CREATE TABLE IF NOT EXISTS extra_mentee (
    mentee_username VARCHAR(50),
    bio VARCHAR(300),
    facebook_link VARCHAR(50),
    linkedin_link VARCHAR (50),
    selected_industry VARCHAR(50),
    primary key (mentee_username),
    foreign key (mentee_username) references Mentee (mentee_username)
    ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS extra_mentor(
        mentor_username VARCHAR(50),
        bio VARCHAR(300),
        facebook_link VARCHAR(50),
        linkedin_link VARCHAR (50),
        selected_industry VARCHAR(50),
        primary key (mentor_username),
        foreign key (mentor_username) references Mentor (mentor_username)
        ON DELETE CASCADE
    )

    CREATE TABLE IF NOT EXISTS menteeEducation(
    mentee_username VARCHAR(50),
    level VARCHAR(50),
    discipline VARCHAR(50),
    institution VARCHAR(50),
    foreign key (mentee_username) references Mentee (mentee_username)
    ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS menteeExperience(
        mentee_username VARCHAR(50),
        role VARCHAR(50),
        organisation VARCHAR(50),
        industry VARCHAR(50),
        foreign key (mentee_username) references Mentee (mentee_username)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS menteeSkills(
        mentee_username VARCHAR(50),
        technical VARCHAR(50),
        interpersonal VARCHAR(50),
        foreign key (mentee_username) references Mentee (mentee_username)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS menteeInterest(
        mentee_username VARCHAR(50),
        interests VARCHAR(50),
        foreign key (mentee_username) references Mentee (mentee_username)
        ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS Mentor(
    mentor_username VARCHAR(50),
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    surname VARCHAR(50) NOT NULL,
    email_address VARCHAR(50) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    imagepath varchar(50) DEFAULT 'mentorupload/default.png',
    hidden boolean not null default 0,
    primary key (mentor_username)
    );

    CREATE TABLE IF NOT EXISTS mentorEducation(
    mentor_username VARCHAR(50),
    level VARCHAR(50),
    discipline VARCHAR(50),
    institution VARCHAR(50),
    foreign key (mentor_username) references Mentor (mentor_username) 
    ON DELETE CASCADE
    )
    CREATE TABLE IF NOT EXISTS mentorExperience(
        mentor_username VARCHAR(50),
        role VARCHAR(50),
        organisation VARCHAR(50),
        industry VARCHAR(50),
        foreign key (mentor_username) references Mentor (mentor_username)
        ON DELETE CASCADE
    )
    CREATE TABLE IF NOT EXISTS mentorSkills(
        mentor_username VARCHAR(50),
        technical VARCHAR(50),
        interpersonal VARCHAR(50),
        foreign key (mentor_username) references Mentor (mentor_username)
        ON DELETE CASCADE
    )
    CREATE TABLE IF NOT EXISTS mentorInterest(
        mentor_username VARCHAR(50),
        interests VARCHAR(50),
        foreign key (mentor_username) references Mentor (mentor_username)
        ON DELETE CASCADE
    )

     CREATE TABLE IF NOT EXISTS mentorPreference(
        mentor_username VARCHAR(50),
        capacity int,
        meetingTime int,
        timeAvailable VARCHAR(50),
        relationship VARCHAR(50),
        primary key (mentor_username),
        foreign key (mentor_username) references Mentor (mentor_username)
        ON DELETE CASCADE
    )

CREATE TABLE IF NOT EXISTS Admin(
    username VARCHAR(50),
    password VARCHAR(255) NOT NULL,
    email_address VARCHAR(50) NOT NULL,
    primary key (username)
    );

CREATE TABLE IF NOT EXISTS Matches(
    mentee_username VARCHAR(50),
    mentee_name varchar(100),
    mentor_username VARCHAR(50),
    mentor_name varchar(100),
    mentor_approval boolean default null,
    admin_approval boolean default null,
    foreign key (mentee_username) references Mentee (mentee_username)
    ON DELETE CASCADE,
    foreign key (mentor_username) references Mentor (mentor_username)
    ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS Meetings(
    mentee_username VARCHAR(50),
    mentee_name VARCHAR(100),
    mentor_username VARCHAR(50),
    mentor_name VARCHAR(100),
    title varchar(50),
    description varchar(100),
    meetingdate DATE,
    starttime TIME,
    endtime TIME,
    approval TINYINT default 0,
    foreign key (mentee_username) references Mentee (mentee_username)
    ON DELETE CASCADE,
    foreign key (mentor_username) references Mentor (mentor_username)
    ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS Resources(
    ResourceID INT AUTO_INCREMENT,
    ResourceName VARCHAR(50),
    ResourceLink VARCHAR(500),
    MentorView TINYINT DEFAULT 0,
    primary key (ResourceID)
    ); 

INSERT INTO admin SELECT "Admin","Admin","OtagoMentorAM@gmail.com" 
    WHERE NOT EXISTS (SELECT 1 FROM admin WHERE username = 'admin');
INSERT INTO Resources SELECT null,'Google Form Mentee', 'https://docs.google.com/forms/d/e/1FAIpQLSfuBQyN55zctJcXROnDPnZgUSnobJXrTb0Z8B9pF1OLFODkWA/viewform?entry.839337160=Very+Satisfied&edit2=2_ABaOnufa2qDOjAJAwK9OwkTaADhhBsJw2W1VOiiqJXCUayDfPVTdcQUz_UFAdAg7aA', '1' 
    WHERE NOT EXISTS (SELECT 1 FROM Resources WHERE ResourceLink = 'https://docs.google.com/forms/d/e/1FAIpQLSfuBQyN55zctJcXROnDPnZgUSnobJXrTb0Z8B9pF1OLFODkWA/viewform?entry.839337160=Very+Satisfied&edit2=2_ABaOnufa2qDOjAJAwK9OwkTaADhhBsJw2W1VOiiqJXCUayDfPVTdcQUz_UFAdAg7aA');
INSERT INTO Resources SELECT null,'Google Form Mentor', 
    'https://docs.google.com/forms/d/e/1FAIpQLSe75D8haNWjmDThtu6BJgfu5yfDltC9EbJeoeJmFn1NnarMhw/viewform', '2' 
    WHERE NOT EXISTS (SELECT 1 FROM Resources WHERE ResourceLink = 'https://docs.google.com/forms/d/e/1FAIpQLSe75D8haNWjmDThtu6BJgfu5yfDltC9EbJeoeJmFn1NnarMhw/viewform');